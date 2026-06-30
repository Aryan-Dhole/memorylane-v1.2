import uuid
import logging
import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from utils.supabase_client import supabase
from utils.queue import get_queue
from utils.limiter import limiter
from services import s3_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic schemas for Free Trial
class TrialStartRequest(BaseModel):
    event_type: str

class TrialStartResponse(BaseModel):
    trial_id: str
    upload_urls: List[dict]

class TrialConfirmRequest(BaseModel):
    trial_id: str
    uploaded_keys: List[str]

class TrialConfirmResponse(BaseModel):
    success: bool


@router.post("/start", response_model=TrialStartResponse)
@limiter.limit("3/day")
def start_trial(request: Request, req: TrialStartRequest):
    """
    Starts a new anonymous free trial session. Generates a session row and 
    returns up to 10 presigned upload URLs. Capped at 3 runs per IP per day.
    """
    try:
        trial_id = str(uuid.uuid4())
        ip_addr = request.client.host if request.client else "unknown"
        s3_prefix = f"uploads/trial/{trial_id}"
        
        # 1. Create trial session row
        try:
            supabase.table("trial_sessions").insert({
                "id": trial_id,
                "ip_address": ip_addr,
                "event_type": req.event_type,
                "status": "pending",
                "s3_prefix": s3_prefix,
                "expires_at": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)).isoformat()
            }).execute()
        except Exception as e:
            logger.error("Failed to insert trial session: %s", e)
            raise HTTPException(status_code=500, detail="Database error starting trial session")

        # 2. Also register a photo_batch row so that we can reuse standard progress tracking
        try:
            supabase.table("photo_batches").insert({
                "id": trial_id,
                "order_id": None,
                "s3_prefix": s3_prefix,
                "total_uploaded": 0,
                "total_processed": 0,
                "ai_status": "pending",
                "ai_progress": 0
            }).execute()
        except Exception as e:
            logger.error("Failed to insert photo batch for trial: %s", e)

        # 3. Generate exactly 10 upload URLs
        upload_urls = []
        for i in range(10):
            filename = f"photo_{i}.jpg"
            url_info = s3_service.generate_upload_url(
                user_id="trial",
                batch_id=trial_id,
                filename=filename
            )
            upload_urls.append({
                "filename": filename,
                "url": url_info["url"],
                "s3_key": url_info["key"]
            })
            
        return TrialStartResponse(trial_id=trial_id, upload_urls=upload_urls)
    except Exception as e:
        logger.exception("Failed to start free trial session")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm", response_model=TrialConfirmResponse)
def confirm_trial(req: TrialConfirmRequest):
    """
    Confirms upload of files for a trial session, registering keys in the photos table.
    """
    if len(req.uploaded_keys) > 10:
        raise HTTPException(status_code=400, detail="Max 10 files allowed for free trial sessions.")

    try:
        photo_records = []
        for key in req.uploaded_keys:
            filename = key.split("/")[-1]
            photo_records.append({
                "batch_id": req.trial_id,
                "s3_key": key,
                "original_filename": filename,
                "is_selected": False
            })

        # Insert files and register counts
        try:
            if photo_records:
                supabase.table("photos").insert(photo_records).execute()
                
            supabase.table("photo_batches").update({
                "total_uploaded": len(req.uploaded_keys)
            }).eq("id", req.trial_id).execute()
            
            supabase.table("trial_sessions").update({
                "status": "processing"
            }).eq("id", req.trial_id).execute()
        except Exception as e:
            logger.error("Failed to commit trial uploads: %s", e)
            raise e

        return TrialConfirmResponse(success=True)
    except Exception as e:
        logger.exception("Failed to confirm trial session files")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process/{trial_id}")
def process_trial(trial_id: str):
    """
    Triggers curation pipeline on the uploaded trial files. Capped at 10 inputs.
    """
    try:
        # Enqueue curation job
        queue = get_queue("ai-pipeline")
        queue.enqueue("ai-pipeline", {
            "batch_id": trial_id,
            "tier": "trial",
            "book_title": "Trial Preview",
            "caption_style": "poetic",
            "language": "English"
        })
        return {"job_id": trial_id}
    except Exception as e:
        logger.exception("Failed to queue trial AI processing job")
        raise HTTPException(status_code=550, detail="Internal queue engine error")


@router.get("/result/{trial_id}")
def get_trial_result(trial_id: str):
    """
    Serves processing progress or selected photo preview stream details.
    """
    try:
        session_res = supabase.table("trial_sessions").select("*").eq("id", trial_id).execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Free trial session not found")
            
        session = session_res.data[0]
        
        # Check expiry
        expires_at = datetime.datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        if now > expires_at:
            supabase.table("trial_sessions").update({"status": "expired"}).eq("id", trial_id).execute()
            return {
                "status": "expired",
                "progress": 100,
                "photos": [],
                "trial_id": trial_id,
                "expires_at": session["expires_at"]
            }
            
        # Fetch batch progress
        progress = 0
        ai_status = "pending"
        batch_res = supabase.table("photo_batches").select("ai_progress", "ai_status").eq("id", trial_id).execute()
        if batch_res.data:
            progress = batch_res.data[0]["ai_progress"]
            ai_status = batch_res.data[0]["ai_status"]
            
        status = session["status"]
        if status == "processing" and ai_status == "completed":
            status = "ready"
        elif status == "pending" and ai_status == "running":
            status = "processing"
            
        return {
            "status": status,
            "progress": progress,
            "photos": session.get("result_photos") or [],
            "trial_id": trial_id,
            "expires_at": session["expires_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to query trial details")
        raise HTTPException(status_code=400, detail="Query operation failed")
