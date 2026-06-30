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

# --- MOCK S3 ENDPOINTS FOR OFFLINE LOCAL DEVELOPMENT ---
# These endpoints are disabled in production (ENV=production)
_is_production = os.getenv("ENV", "development").lower() == "production"

if not _is_production:

    @router.put("/mock-s3/uploads/{user_id}/{batch_id}/{filename}")
    async def mock_s3_upload(user_id: str, batch_id: str, filename: str, request: Request):
        """
        Local mock endpoint simulating AWS S3 direct upload destination.
        Writes file body directly to local disk.
        """
        target_dir = os.path.join(LOCAL_S3_DIR, "uploads", user_id, batch_id)
        os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, filename)
        body = await request.body()
        
        try:
            with open(file_path, "wb") as f:
                f.write(body)
            logger.info("Saved local mock S3 file: %s", file_path)
            return {"message": "Upload successful (local mock S3)"}
        except Exception as e:
            logger.error("Failed to save local mock S3 file: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/mock-s3/uploads/{user_id}/{batch_id}/{filename}")
    def mock_s3_download(user_id: str, batch_id: str, filename: str):
        """
        Local mock endpoint simulating AWS S3 download link.
        Serves the file from local disk, or redirects to a high-quality placeholder if missing.
        """
        file_path = os.path.join(LOCAL_S3_DIR, "uploads", user_id, batch_id, filename)
        if not os.path.exists(file_path):
            # Premium Unsplash placeholders (already whitelisted in next.config.ts)
            import re
            match = re.search(r'\d+', filename)
            idx = int(match.group()) if match else 0
            
            unsplash_urls = [
                "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop", # Wedding
                "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop", # Bride/Groom
                "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop", # Reception
                "https://images.unsplash.com/photo-1507504038482-762103743ec1?w=800&auto=format&fit=crop", # Details
                "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop", # Couple kiss
                "https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop", # Toast
                "https://images.unsplash.com/photo-1520854221256-174b1ec358ef?w=800&auto=format&fit=crop", # Bridal party
                "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&auto=format&fit=crop", # Rings
                "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop", # First dance
                "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop", # Honeymoon
            ]
            placeholder_url = unsplash_urls[idx % len(unsplash_urls)]
            logger.info("Local mock file %s not found. Redirecting to Unsplash placeholder: %s", filename, placeholder_url)
            return RedirectResponse(url=placeholder_url)
            
        return FileResponse(file_path)

    # Add fallback for S3 processed images serving
    @router.get("/mock-s3/processed/{order_id}/selected/{filename}")
    def mock_s3_download_processed(order_id: str, filename: str):
        file_path = os.path.join(LOCAL_S3_DIR, "processed", order_id, "selected", filename)
        if not os.path.exists(file_path):
            import re
            match = re.search(r'\d+', filename)
            idx = int(match.group()) if match else 0
            
            unsplash_urls = [
                "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1507504038482-762103743ec1?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1520854221256-174b1ec358ef?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop"
            ]
            placeholder_url = unsplash_urls[idx % len(unsplash_urls)]
            logger.info("Local processed file %s not found. Redirecting to Unsplash placeholder: %s", filename, placeholder_url)
            return RedirectResponse(url=placeholder_url)
        return FileResponse(file_path)

