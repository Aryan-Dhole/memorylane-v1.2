import os
import logging
import tempfile
import zipfile
import re
import shutil
from services.s3_service import get_s3_client

logger = logging.getLogger(__name__)

def slugify(text: str) -> str:
    """Converts caption text into a clean snake_case slug (lowercase, max 40 chars)."""
    # Remove all special characters, keep letters, numbers, and spaces
    clean = re.sub(r"[^\w\s-]", "", text.lower())
    # Replace spaces and dashes with underscores
    clean = re.sub(r"[\s-]+", "_", clean)
    # Strip leading/trailing underscores
    clean = clean.strip("_")
    # Truncate to 40 characters
    return clean[:40]

async def generate_zip(
    order_id: str,
    selected_photos: list  # [{"s3_key": str, "caption": str, "sequence_index": int}]
) -> str:
    """
    Downloads selected photos, renames them sequentially using caption slugs,
    and uploads a compiled ZIP file to S3 under `books/{order_id}/selected_photos.zip`.
    Returns: S3 key of the uploaded ZIP.
    """
    logger.info("Starting ZIP generation for order: %s, photos count: %d", order_id, len(selected_photos))
    
    temp_dir = tempfile.mkdtemp()
    zip_temp_path = os.path.join(temp_dir, "selected_photos.zip")
    
    s3_client = get_s3_client()
    bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
    LOCAL_S3_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_s3_bucket"))
    
    try:
        with zipfile.ZipFile(zip_temp_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for idx, photo in enumerate(selected_photos):
                s3_key = photo.get("s3_key")
                caption = photo.get("caption", "photo")
                seq_idx = photo.get("sequence_index", idx + 1)
                
                # Slugify caption
                cap_slug = slugify(caption)
                if not cap_slug:
                    cap_slug = "photo"
                
                # Format name: e.g., 001_bride_makeup.jpg
                filename_in_zip = f"{seq_idx:03d}_{cap_slug}.jpg"
                
                # Temporary path to write the downloaded image
                temp_img_path = os.path.join(temp_dir, f"photo_{idx}.jpg")
                success = False
                
                # Download from S3 or fetch from local mock S3
                if s3_client:
                    try:
                        s3_client.download_file(bucket_name, s3_key, temp_img_path)
                        success = True
                    except Exception as e:
                        logger.error("Failed to download S3 photo for ZIP: %s, error: %s", s3_key, e)
                else:
                    local_src = os.path.join(LOCAL_S3_DIR, s3_key) if s3_key else ""
                    if local_src and os.path.exists(local_src):
                        shutil.copy(local_src, temp_img_path)
                        success = True
                        
                # Add to ZIP if download succeeded
                if success and os.path.exists(temp_img_path):
                    zip_file.write(temp_img_path, filename_in_zip)
                    
        # Upload the generated ZIP file to S3
        s3_key = f"books/{order_id}/selected_photos.zip"
        
        if s3_client:
            try:
                s3_client.upload_file(zip_temp_path, bucket_name, s3_key)
                logger.info("ZIP archive successfully uploaded to S3 at key: %s", s3_key)
            except Exception as ue:
                logger.error("Failed to upload ZIP archive to S3: %s", ue)
                # Local mock fallback copy
                local_dest = os.path.join(LOCAL_S3_DIR, s3_key)
                os.makedirs(os.path.dirname(local_dest), exist_ok=True)
                shutil.copy(zip_temp_path, local_dest)
        else:
            local_dest = os.path.join(LOCAL_S3_DIR, s3_key)
            os.makedirs(os.path.dirname(local_dest), exist_ok=True)
            shutil.copy(zip_temp_path, local_dest)
            logger.info("Saved ZIP locally to mock S3 at path: %s", local_dest)
            
    finally:
        # Clean up temp files
        try:
            shutil.rmtree(temp_dir)
        except Exception as ce:
            logger.error("Failed to clean up ZIP temp directory: %s", ce)
            
    return s3_key
