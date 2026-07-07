import os
import uuid
import logging
from fastapi import APIRouter, HTTPException, File, UploadFile, Request, Header
from typing import Optional
from fastapi.responses import FileResponse, RedirectResponse

from models.schemas import (
    UploadInitRequest, UploadInitResponse, UploadUrlItem,
    UploadConfirmRequest, UploadConfirmResponse
)
from services import s3_service
from utils.supabase_client import supabase

from utils.limiter import limiter

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Root directory for local mock S3 storage
LOCAL_S3_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_s3_bucket"))

@router.post("/init", response_model=UploadInitResponse)
@limiter.limit("10/minute")
def init_upload(request: Request, req: UploadInitRequest, authorization: Optional[str] = Header(None)):
    """
    Initiates upload by creating a photo batch in the database
    and generating S3 presigned URLs for each file.
    """
    try:
        from utils.supabase_client import get_user_id_from_auth
        user_id = get_user_id_from_auth(authorization)
        
        # Verify order tier limits
        tier = "free"
        try:
            ord_res = supabase.table("orders").select("tier").eq("id", req.order_id).execute()
            if ord_res.data:
                tier = ord_res.data[0].get("tier", "free").lower()
        except Exception as e:
            logger.error("DB error fetching order tier: %s", e)

        limits = {
            "free": 50,
            "basic": 500,
            "premium": 2000,
            "photographer": 5000
        }
        max_allowed = limits.get(tier, 50)
        if req.file_count > max_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Upload file count ({req.file_count}) exceeds the limit of {max_allowed} images allowed for the '{tier}' tier."
            )
            
        batch_id = str(uuid.uuid4())
        s3_prefix = f"uploads/{user_id}/{batch_id}"
        
        # Create batch record in Supabase
        try:
            supabase.table("photo_batches").insert({
                "id": batch_id,
                "order_id": req.order_id,
                "s3_prefix": s3_prefix,
                "total_uploaded": 0,
                "total_processed": 0,
                "ai_status": "pending",
                "ai_progress": 0
            }).execute()
        except Exception as e:
            logger.error("Supabase insert failed for photo_batch: %s", e)
            if os.getenv("ENV") == "production":
                raise e
            
        # Generate presigned URLs
        upload_urls = []
        for i in range(req.file_count):
            filename = f"photo_{i}.jpg"
            url_info = s3_service.generate_upload_url(
                user_id=user_id,
                batch_id=batch_id,
                filename=filename
            )
            upload_urls.append(UploadUrlItem(
                filename=filename,
                url=url_info["url"],
                s3_key=url_info["key"]
            ))
            
        return UploadInitResponse(batch_id=batch_id, upload_urls=upload_urls)
    except Exception as e:
        logger.exception("Failed to initialize upload")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to initialize upload batch", "code": "UPLOAD_INIT_ERROR", "status": 400}
        )

@router.post("/confirm", response_model=UploadConfirmResponse)
def confirm_upload(req: UploadConfirmRequest):
    """
    Confirms upload completion by inserting individual photos
    and updating the batch total_uploaded count.
    """
    try:
        photo_records = []
        for key in req.uploaded_keys:
            filename = key.split("/")[-1]
            photo_records.append({
                "batch_id": req.batch_id,
                "s3_key": key,
                "original_filename": filename,
                "is_selected": False
            })
            
        # Batch insert photos into Supabase
        try:
            if photo_records:
                supabase.table("photos").insert(photo_records).execute()
                
            # Update total uploaded on batch
            supabase.table("photo_batches").update({
                "total_uploaded": len(req.uploaded_keys)
            }).eq("id", req.batch_id).execute()
        except Exception as e:
            logger.error("Supabase operations failed in confirm_upload: %s", e)
            if os.getenv("ENV") == "production":
                raise e
            
        return UploadConfirmResponse(
            success=True,
            total_confirmed=len(req.uploaded_keys)
        )
    except Exception as e:
        logger.exception("Failed to confirm upload")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to confirm batch uploads", "code": "UPLOAD_CONFIRM_ERROR", "status": 400}
        )

# --- LOCAL DEVELOPMENT FILE SERVING & UPLOAD ENDPOINTS ---

@router.put("/local-dev-files/{file_path:path}")
async def upload_local_dev_file(file_path: str, request: Request):
    """
    Local development upload endpoint simulating AWS S3 destination.
    Writes file body directly to local disk.
    """
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=404, detail="Not available in production")
        
    target_path = os.path.join(LOCAL_S3_DIR, file_path)
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    body = await request.body()
    try:
        with open(target_path, "wb") as f:
            f.write(body)
        logger.info("Saved local dev file: %s", target_path)
        return {"message": "Upload successful (local dev files)"}
    except Exception as e:
        logger.error("Failed to save local dev file: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/local-dev-files/{file_path:path}")
async def serve_local_dev_file(file_path: str):
    """
    Local development file serving endpoint.
    Serves the file from local disk. No external image service fallback.
    """
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=404, detail="Not available in production")
        
    local_path = os.path.join(LOCAL_S3_DIR, file_path)
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(local_path)

@router.get("/presigned-url/{s3_key:path}")
def get_presigned_url(s3_key: str):
    """
    Generates a pre-signed S3 download URL for a given S3 key.
    """
    try:
        url = s3_service.generate_download_url(s3_key)
        return {"url": url}
    except Exception as e:
        logger.error("Failed to generate presigned URL: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

