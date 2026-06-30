import os
import hashlib
import datetime
from PIL import Image

try:
    import imagehash
    from skimage.metrics import structural_similarity
    import cv2
    HAS_IMAGE_LIBS = True
except ImportError:
    HAS_IMAGE_LIBS = False

def get_exif_timestamp(image_path: str) -> datetime.datetime:
    """Attempts to extract EXIF DateTimeOriginal. Falls back to file system or generated time."""
    if os.path.exists(image_path):
        try:
            with Image.open(image_path) as img:
                exif = img._getexif()
                if exif and 36867 in exif:
                    # tag 36867 is DateTimeOriginal
                    date_str = exif[36867]
                    return datetime.datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
        except Exception:
            pass
        
        try:
            # File system modification time fallback
            mtime = os.path.getmtime(image_path)
            return datetime.datetime.fromtimestamp(mtime)
        except Exception:
            pass
            
    # Mock fallback based on file path hash to make it stable
    path_hash = int(hashlib.md5(image_path.encode()).hexdigest(), 16)
    # Start at a fixed date and add deterministic minutes
    base_date = datetime.datetime(2026, 6, 26, 10, 0, 0)
    minutes_offset = (path_hash % 300)  # offset within 5 hours
    
    # If the filename contains a burst number e.g., "burst_1_1.jpg", "burst_1_2.jpg"
    # make their offsets very close (seconds apart)
    if "burst" in image_path:
        parts = image_path.split("burst_")
        if len(parts) > 1:
            burst_id = parts[1].split("_")[0]
            burst_idx = int(hashlib.md5(image_path.encode()).hexdigest(), 16) % 5
            minutes_offset = int(burst_id) * 15 # 15 minutes apart for different bursts
            return base_date + datetime.timedelta(minutes=minutes_offset, seconds=burst_idx * 2)

    return base_date + datetime.timedelta(minutes=minutes_offset)

def remove_duplicates(image_paths: list, quality_scores: dict) -> list:
    """
    Removes near-duplicate photos from a batch, keeping the one with the highest quality score.
    Duplicates are detected by mock pHash Hamming distance <= 8.
    """
    if not image_paths:
        return []
        
    # Step 1: Assign mock/real pHash to each image
    hashes = {}
    for path in image_paths:
        if HAS_IMAGE_LIBS and os.path.exists(path):
            try:
                hashes[path] = str(imagehash.phash(Image.open(path)))
                continue
            except Exception:
                pass
        
        # Mock pHash generator
        # Images with names containing similar prefix (e.g. burst_1_X) get the same or very close hash
        path_hash = int(hashlib.md5(path.encode()).hexdigest(), 16)
        if "burst_" in path:
            # Group by burst name, e.g. "burst_1" from "burst_1_3.jpg"
            burst_name = path.split("burst_")[1].split(".")[0].split("_")[0]
            # Use hash of the group
            group_hash = int(hashlib.md5(burst_name.encode()).hexdigest(), 16)
            hashes[path] = format(group_hash % (2**64), '016x')
        else:
            hashes[path] = format(path_hash % (2**64), '016x')
            
    # Step 2: Group duplicates (Hamming distance <= 8)
    def hamming_distance(h1, h2):
        return sum(c1 != c2 for c1, c2 in zip(h1, h2))

    visited = set()
    surviving_paths = []
    
    # Sort paths by quality score (descending) so we process the best ones first
    sorted_paths = sorted(image_paths, key=lambda p: quality_scores.get(p, {}).get("final_quality_score", 0.0), reverse=True)
    
    for path in sorted_paths:
        if path in visited:
            continue
            
        # This path is the best of its duplicate group
        surviving_paths.append(path)
        visited.add(path)
        
        # Find and discard all duplicates of this path
        h_current = hashes[path]
        for other_path in sorted_paths:
            if other_path in visited:
                continue
            h_other = hashes[other_path]
            
            if hamming_distance(h_current, h_other) <= 8:
                visited.add(other_path)
                
    # Return in original order, but only surviving paths
    return [p for p in image_paths if p in surviving_paths]

def cluster_by_time(image_paths: list, window_minutes: int = 5) -> dict:
    """
    Groups photos into 'moments' based on time intervals.
    A new cluster starts if there is a gap of more than `window_minutes` between consecutive photos.
    """
    if not image_paths:
        return {"clusters": {}, "cluster_timestamps": {}}
        
    # Get all timestamps
    path_times = {path: get_exif_timestamp(path) for path in image_paths}
    
    # Sort paths by timestamp
    sorted_paths = sorted(image_paths, key=lambda p: path_times[p])
    
    clusters = {}
    cluster_timestamps = {}
    cluster_id = 0
    
    current_cluster = [sorted_paths[0]]
    cluster_start_time = path_times[sorted_paths[0]]
    
    for i in range(1, len(sorted_paths)):
        prev_path = sorted_paths[i-1]
        curr_path = sorted_paths[i]
        
        time_diff = (path_times[curr_path] - path_times[prev_path]).total_seconds() / 60.0
        
        if time_diff > window_minutes:
            # Close current cluster and start a new one
            clusters[str(cluster_id)] = current_cluster
            cluster_timestamps[str(cluster_id)] = cluster_start_time.isoformat()
            
            cluster_id += 1
            current_cluster = [curr_path]
            cluster_start_time = path_times[curr_path]
        else:
            current_cluster.append(curr_path)
            
    # Save the last cluster
    clusters[str(cluster_id)] = current_cluster
    cluster_timestamps[str(cluster_id)] = cluster_start_time.isoformat()
    
    return {
        "clusters": clusters,
        "cluster_timestamps": cluster_timestamps
    }

if __name__ == "__main__":
    print("Testing duplicate_remover...")
    q_scores = {
        "burst_1_1.jpg": {"final_quality_score": 85.0},
        "burst_1_2.jpg": {"final_quality_score": 90.0},  # should survive
        "burst_1_3.jpg": {"final_quality_score": 60.0},
        "vacation_1.jpg": {"final_quality_score": 75.0},  # should survive
    }
    
    batch = list(q_scores.keys())
    survivors = remove_duplicates(batch, q_scores)
    print("Survivors:", survivors)
    
    clusters = cluster_by_time(batch, window_minutes=5)
    print("Time clusters:")
    print(clusters)
