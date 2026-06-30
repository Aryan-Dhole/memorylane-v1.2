import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request

from models.schemas import (
    AnalyzeRequest, AnalyzeResponse, AnalyzeStatusResponse, AnalyzeResultResponse, SelectedPhotoMetadata, ChapterMetadata
)
from utils.supabase_client import supabase
from utils.queue import get_queue
from utils.limiter import limiter
from services import s3_service

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/{batch_id}", response_model=AnalyzeResponse)
@limiter.limit("5/minute")
def run_analysis(request: Request, batch_id: str, req: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Submits a background task to process the photo batch with the AI pipeline.
    """
    try:
        # 1. Fetch batch details from Supabase to verify it exists
        try:
            batch_res = supabase.table("photo_batches").select("*").eq("id", batch_id).execute()
            if not batch_res.data:
                # For local execution without database rows, we still allow proceeding
                logger.warning("Batch %s not found in database. Proceeding in mock/standalone mode.", batch_id)
        except Exception as e:
            logger.error("Failed to query batch from database: %s. Continuing in mock mode.", e)
            
        # 2. Add job to the pipeline task queue
        queue = get_queue("ai-pipeline")
        job_data = {
            "batch_id": batch_id,
            "book_size": req.book_size,
            "event_type": "wedding",  # default event type, can be dynamic
            "caption_style": req.caption_style,
            "language": req.language
        }
        
        # Push job to queue
        queue.add("ai-pipeline", job_data)
        
        # 3. If running in-memory (no Redis), we trigger the background task immediately using FastAPI's BackgroundTasks
        if not queue.use_redis:
            from worker import process_job
            class FakeJob:
                def __init__(self, data):
                    self.data = data
            background_tasks.add_task(process_job, FakeJob(job_data))
            logger.info("Triggered task processing directly via FastAPI BackgroundTasks (in-memory mode)")
            
        return AnalyzeResponse(job_id=batch_id, status="queued")
    except Exception as e:
        logger.exception("Failed to run analysis")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to submit analysis job", "code": "ANALYZE_SUBMIT_ERROR", "status": 400}
        )

@router.get("/status/{batch_id}", response_model=AnalyzeStatusResponse)
def get_analysis_status(batch_id: str):
    """
    Checks the status of the AI pipeline batch job.
    """
    import uuid
    try:
        uuid.UUID(batch_id)
    except ValueError:
        logger.info("Serving mock status for non-UUID batch_id: %s", batch_id)
        return AnalyzeStatusResponse(status="completed", progress=100, eta_seconds=0)

    try:
        res = supabase.table("photo_batches").select("ai_status", "ai_progress").eq("id", batch_id).execute()
        if res.data:
            batch = res.data[0]
            status = batch.get("ai_status", "pending")
            progress = batch.get("ai_progress", 0)
            
            # Simple ETA calculation
            eta = 0
            if status == "running":
                eta = int((100 - progress) * 1.5)  # ~1.5s per percentage point
            elif status == "pending" or status == "queued":
                eta = 180  # Default 3 mins
                
            return AnalyzeStatusResponse(status=status, progress=progress, eta_seconds=eta)
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "Batch not found in database", "code": "BATCH_NOT_FOUND", "status": 404}
            )
    except Exception as e:
        logger.exception("Failed to fetch status")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to retrieve analysis status", "code": "ANALYZE_STATUS_ERROR", "status": 400}
        )

@router.get("/result/{batch_id}", response_model=AnalyzeResultResponse)
def get_analysis_result(batch_id: str):
    """
    Fetches the final AI-selected photos and chapters for the book layout.
    """
    import uuid
    is_valid_uuid = False
    try:
        uuid.UUID(batch_id)
        is_valid_uuid = True
    except ValueError:
        pass

    if is_valid_uuid:
        try:
            # Get selected photos
            photos_res = supabase.table("photos") \
                .select("*") \
                .eq("batch_id", batch_id) \
                .eq("is_selected", True) \
                .order("sequence_index") \
                .execute()
                
            # Get batch pipeline result metadata (for chapters and duration)
            batch_res = supabase.table("photo_batches").select("pipeline_result", "total_uploaded").eq("id", batch_id).execute()
            
            if photos_res.data:
                selected_photos = []
                for p in photos_res.data:
                    # Resolve key path to a presigned S3 download URL (or local path)
                    download_url = s3_service.generate_download_url(p["s3_key"])
                    vis_analysis = p.get("visual_analysis") or {}
                    dom_emotion = vis_analysis.get("dominant_emotion") or "candid_unaware"
                    selected_photos.append(SelectedPhotoMetadata(
                        path=download_url,
                        caption=p.get("caption") or "",
                        chapter=p.get("chapter_index") or 0,
                        scene=p.get("scene_label") or "candid",
                        dominant_emotion=dom_emotion
                    ))
                    
                pipeline_result = {}
                total_input = len(selected_photos)
                if batch_res.data:
                    batch = batch_res.data[0]
                    pipeline_result = batch.get("pipeline_result") or {}
                    total_input = batch.get("total_uploaded") or len(selected_photos)
                    
                # Parse chapters
                chapters = []
                raw_chapters = pipeline_result.get("chapters", [])
                for ch in raw_chapters:
                    chapters.append(ChapterMetadata(
                        title=ch.get("title", "Chapter"),
                        start_index=ch.get("start_index", 0)
                    ))
                    
                if not chapters:
                    chapters = [ChapterMetadata(title="My Story", start_index=0)]
                    
                proc_time = pipeline_result.get("processing_time_seconds", 0.0)
                
                return AnalyzeResultResponse(
                    selected_photos=selected_photos,
                    total_input=total_input,
                    total_selected=len(selected_photos),
                    chapters=chapters,
                    processing_time_seconds=proc_time
                )
            else:
                raise HTTPException(status_code=404, detail="No selected photos found for this batch.")
        except Exception as e:
            logger.exception("Failed to query analysis result from database")
            raise HTTPException(status_code=500, detail="Database query operation failed.")
