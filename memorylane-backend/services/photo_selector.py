import time
import asyncio
import os
import uuid
import logging
from typing import List, Dict, Any

from services.quality_scorer import score_image_quality
from services.face_detector import detect_faces, cluster_faces_in_batch, extract_and_save_face_crops
from services.duplicate_remover import remove_duplicates, cluster_by_time
from services.aesthetic_scorer import score_aesthetic
from services.story_sequencer import sequence_photos, detect_moments, classify_scene_mock
from services.caption_generator import analyze_photo_visually, generate_captions_sequential

logger = logging.getLogger(__name__)

async def run_full_pipeline(
    image_paths: list,
    target_count: int,
    event_type: str,
    caption_style: str,
    language: str,
    event_name: str = "My Event",
    order_id: str = "default_order"
) -> dict:
    """
    Revised main event gallery curation pipeline execution orchestration.
    """
    start_time = time.time()
    
    # 1. Run quality scorer on all images in parallel
    quality_tasks = [asyncio.to_thread(score_image_quality, path) for path in image_paths]
    quality_results_list = await asyncio.gather(*quality_tasks)
    quality_results = {path: res for path, res in zip(image_paths, quality_results_list)}
    
    # 2. Reject low quality or too low resolution
    surviving_quality = [path for path in image_paths if not quality_results[path]["reject"]]
    if not surviving_quality:
        surviving_quality = image_paths
        
    # 3. Run face detector on surviving images in parallel
    face_tasks = [asyncio.to_thread(detect_faces, path) for path in surviving_quality]
    face_results_list = await asyncio.gather(*face_tasks)
    face_results = {path: res for path, res in zip(surviving_quality, face_results_list)}
    
    # 4. Perform face clustering across the batch
    clustering_res = cluster_faces_in_batch(surviving_quality)
    face_clusters = clustering_res["clusters"]
    key_face_clusters = clustering_res["key_faces"]
    
    # 5. Remove duplicates and perform time-based scene clustering
    surviving_dedup = remove_duplicates(surviving_quality, quality_results)
    time_clustering_res = cluster_by_time(surviving_dedup, window_minutes=5)
    time_clusters = time_clustering_res["clusters"]
    time_timestamps = time_clustering_res["cluster_timestamps"]
    
    all_timestamps = {}
    for cluster_id, paths in time_clusters.items():
        c_time = time_timestamps[cluster_id]
        import datetime
        dt = datetime.datetime.fromisoformat(c_time)
        for i, path in enumerate(paths):
            all_timestamps[path] = (dt + datetime.timedelta(seconds=i)).isoformat()
            
    # 6. Run aesthetic scorer on surviving deduped images in parallel
    aesthetic_tasks = [asyncio.to_thread(score_aesthetic, path) for path in surviving_dedup]
    aesthetic_results_list = await asyncio.gather(*aesthetic_tasks)
    aesthetic_results = {path: res for path, res in zip(surviving_dedup, aesthetic_results_list)}
    
    # 7. Compute final ranking score for each image
    final_ranks = {}
    for path in surviving_dedup:
        q_score = quality_results[path]["final_quality_score"]
        f_score = face_results[path]["face_score"]
        a_score = aesthetic_results[path]
        final_ranks[path] = float(q_score * 0.30 + f_score * 0.30 + (a_score * 10.0) * 0.40)
        
    scene_labels = {path: classify_scene_mock(path) for path in surviving_dedup}
    
    limit_count = min(target_count, len(surviving_dedup))
    logger.info("Curation starting: image_paths count=%s, target_count=%s, limit_count=%s", len(image_paths), target_count, limit_count)
    selected_set = set()
    
    # A. Enforce diversity (1 photo per scene type if possible)
    scene_to_photos = {}
    for path in surviving_dedup:
        scene = scene_labels[path]
        if scene not in scene_to_photos:
            scene_to_photos[scene] = []
        scene_to_photos[scene].append(path)
        
    for scene in scene_to_photos:
        scene_to_photos[scene].sort(key=lambda p: final_ranks[p], reverse=True)
        if len(selected_set) < limit_count:
            best_in_scene = scene_to_photos[scene][0]
            selected_set.add(best_in_scene)
            
    # B. Enforce key faces diversity (at least 3 photos per key face cluster if possible)
    for cluster_id in key_face_clusters:
        cluster_paths = face_clusters.get(cluster_id, [])
        sorted_cluster = sorted([p for p in cluster_paths if p in final_ranks], key=lambda p: final_ranks[p], reverse=True)
        added_count = sum(1 for p in sorted_cluster if p in selected_set)
        for p in sorted_cluster:
            if added_count >= 3 or len(selected_set) >= limit_count:
                break
            if p not in selected_set:
                selected_set.add(p)
                added_count += 1
                
    # C. Fill remaining slots with highest ranked photos
    remaining_sorted = sorted(surviving_dedup, key=lambda p: final_ranks[p], reverse=True)
    for p in remaining_sorted:
        if len(selected_set) >= limit_count:
            break
        selected_set.add(p)
        
    selected_list = list(selected_set)
    logger.info("Curation complete: selected %s photos out of %s inputs", len(selected_list), len(image_paths))
    
    # 9. Sequence the selected photos
    sequenced_list = sequence_photos(selected_list, scene_labels, all_timestamps)
    
    # 10. Detect moments
    moments = await detect_moments(sequenced_list, all_timestamps, scene_labels, event_name, event_type)
    
    # Map index to moment for response
    moment_map = {}
    for i, m in enumerate(moments):
        start_idx = m["start_index"]
        moment_map[start_idx] = i
        
    # 11. Run Vision Analysis pass with controlled concurrency (e.g., max 3 at a time) to avoid API rate limits
    sem = asyncio.Semaphore(3)
    async def safe_analyze(path):
        async with sem:
            res = await analyze_photo_visually(path)
            # Add a small delay between requests to respect rate limits
            await asyncio.sleep(0.3)
            return res
            
    visual_analysis_tasks = [safe_analyze(p) for p in sequenced_list]
    visual_analysis_results = await asyncio.gather(*visual_analysis_tasks)
    
    # 12. Run Sequential Caption Generation
    current_moment_idx = 0
    photos_for_captions = []
    for i, path in enumerate(sequenced_list):
        if i in moment_map:
            current_moment_idx = moment_map[i]
        photos_for_captions.append({
            "path": path,
            "visual_analysis": visual_analysis_results[i],
            "chapter_index": current_moment_idx
        })
        
    moments_dict = {idx: {"name": m["title"]} for idx, m in enumerate(moments)}
    event_context = {
        "event_name": event_name,
        "event_type": event_type,
        "language": language,
        "caption_style": caption_style,
        "chapters": moments_dict
    }
    captions = await generate_captions_sequential(photos_for_captions, event_context)
    
    # 13. Crop and upload face thumbnails for key clusters
    face_crops_s3 = await extract_and_save_face_crops(order_id, face_clusters)
    
    # 14. Format final response objects
    formatted_photos = []
    current_moment_idx = 0
    for i, path in enumerate(sequenced_list):
        if i in moment_map:
            current_moment_idx = moment_map[i]
            
        p_clusters = []
        for cluster_id, paths in face_clusters.items():
            if path in paths:
                p_clusters.append(int(cluster_id))
                
        formatted_photos.append({
            "path": path,
            "caption": captions[i],
            "visual_analysis": visual_analysis_results[i],
            "chapter": current_moment_idx,
            "scene": scene_labels.get(path, "unknown"),
            "face_cluster_ids": p_clusters
        })
        
    face_clusters_payload = []
    for cluster_id, paths in face_clusters.items():
        c_idx = int(cluster_id)
        face_clusters_payload.append({
            "cluster_index": c_idx,
            "face_crop_s3": face_crops_s3.get(c_idx, ""),
            "photo_count": len(paths)
        })
        
    processing_time = time.time() - start_time
    
    return {
        "selected_photos": formatted_photos,
        "face_clusters": face_clusters_payload,
        "total_input": len(image_paths),
        "total_selected": len(formatted_photos),
        "chapters": moments,
        "processing_time_seconds": round(processing_time, 2)
    }
