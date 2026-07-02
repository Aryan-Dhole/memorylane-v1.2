import os
import logging
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from dotenv import load_dotenv

# Load dotenv relative to the backend root directory
services_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(services_dir, ".."))
load_dotenv(os.path.join(backend_dir, ".env"))

logger = logging.getLogger(__name__)

# Root directory for local mock S3 storage
LOCAL_S3_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_s3_bucket"))

def get_s3_client():
    # If in development mode, default to local mock S3 storage unless USE_LIVE_S3 is explicitly set to true
    if os.getenv("ENV") != "production" and os.getenv("USE_LIVE_S3", "false").lower() != "true":
        return None

    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "ap-south-1")
    
    if not aws_access_key or "mock" in aws_access_key or not aws_secret_key or "mock" in aws_secret_key:
        # Return None to trigger local disk fallback
        return None
        
    try:
        # Config for S3 transfer speeds and signature version
        s3_config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3}
        )
        return boto3.client(
            "s3",
            region_name=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            config=s3_config
        )
    except Exception as e:
        logger.error("Failed to initialize boto3 S3 client: %s. Using local fallback.", e)
        return None

def generate_upload_url(user_id: str, batch_id: str, filename: str) -> dict:
    """
    Generates a pre-signed S3 upload URL.
    Returns:
        {"url": str, "key": str, "expires_in": 3600}
    """
    s3_key = f"uploads/{user_id}/{batch_id}/{filename}"
    bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
    s3_client = get_s3_client()
    
    if s3_client:
        try:
            url = s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key,
                    "ContentType": "image/jpeg"
                },
                ExpiresIn=3600
            )
            return {"url": url, "key": s3_key, "expires_in": 3600}
        except ClientError as e:
            logger.error("ClientError generating presigned upload url: %s", e)
            
    # Mock / Local fallback url
    # Point the upload URL to our local FastAPI server upload endpoint
    api_url = os.getenv("BACKEND_URL") or os.getenv("NEXT_PUBLIC_API_URL") or os.getenv("FRONTEND_URL", "http://127.0.0.1:8000").replace("3000", "8000").replace("localhost", "127.0.0.1")
    local_url = f"{api_url}/upload/mock-s3/{s3_key}"
    return {"url": local_url, "key": s3_key, "expires_in": 3600}
    
def generate_download_url(s3_key: str, expires_in: int = 300) -> str:
    """
    Generates a pre-signed S3 download URL or returns the key if it is a full web URL.
    """
    if not s3_key:
        return ""
        
    if s3_key.startswith("http://") or s3_key.startswith("https://"):
        return s3_key
        
    bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
    s3_client = get_s3_client()
    
    if s3_client:
        try:
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key
                },
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            logger.error("ClientError generating presigned download url: %s", e)
            
    # Mock / Local fallback url
    api_url = os.getenv("BACKEND_URL") or os.getenv("NEXT_PUBLIC_API_URL") or os.getenv("FRONTEND_URL", "http://127.0.0.1:8000").replace("3000", "8000").replace("localhost", "127.0.0.1")
    local_url = f"{api_url}/upload/mock-s3/{s3_key}"
    return local_url

def delete_batch(batch_prefix: str) -> bool:
    """
    Deletes all files under a prefix.
    """
    bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
    s3_client = get_s3_client()
    
    if s3_client:
        try:
            # List objects under prefix
            objects = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=batch_prefix)
            if "Contents" in objects:
                delete_keys = {"Objects": [{"Key": obj["Key"]} for obj in objects["Contents"]]}
                s3_client.delete_objects(Bucket=bucket_name, Delete=delete_keys)
            return True
        except ClientError as e:
            logger.error("Failed to delete batch from S3: %s", e)
            return False
            
    # Mock / Local fallback deletion
    local_prefix_dir = os.path.join(LOCAL_S3_DIR, batch_prefix)
    if os.path.exists(local_prefix_dir):
        import shutil
        try:
            shutil.rmtree(local_prefix_dir)
            return True
        except Exception as e:
            logger.error("Failed to delete local mock S3 prefix directory: %s", e)
            
    return True


def download_to_temp(s3_key: str) -> str:
    """
    Downloads an S3 object to a local temp directory and returns the local path.
    In dev mode (no real S3), resolves from local_s3_bucket.
    Returns the local path or empty string on failure.
    """
    if not s3_key:
        return ""

    # 1. Check if it's already a local path that exists
    if os.path.exists(s3_key):
        return s3_key

    # 2. Check local_s3_bucket fallback (dev mode)
    local_resolved = os.path.join(LOCAL_S3_DIR, s3_key)
    if os.path.exists(local_resolved):
        return local_resolved

    # 3. Try downloading from real S3
    bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
    s3_client = get_s3_client()
    if s3_client:
        try:
            import tempfile
            temp_dir = os.path.join(tempfile.gettempdir(), "memorylane_pipeline")
            os.makedirs(temp_dir, exist_ok=True)
            # Use s3_key as relative path within temp dir
            local_path = os.path.join(temp_dir, s3_key.replace("/", os.sep))
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            # Skip re-download if already cached in temp
            if os.path.exists(local_path):
                return local_path
            s3_client.download_file(bucket_name, s3_key, local_path)
            logger.info("Downloaded S3 object to temp: %s", local_path)
            return local_path
        except ClientError as e:
            logger.error("Failed to download S3 object %s: %s", s3_key, e)
        except Exception as e:
            logger.error("Unexpected error downloading S3 object %s: %s", s3_key, e)

    return ""
