import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

# Load dotenv relative to the backend root directory
utils_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(utils_dir, ".."))
load_dotenv(os.path.join(backend_dir, ".env"))

logger = logging.getLogger(__name__)

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or "mock" in url or not key or "mock" in key:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY not properly configured. Using a dummy or mock client.")
        # Return a dummy client class to prevent startup crashes when working locally with mock credentials
        class MockSupabaseClient:
            def __getattr__(self, name):
                return self
            def execute(self, *args, **kwargs):
                class MockResponse:
                    data = []
                return MockResponse()
            def __call__(self, *args, **kwargs):
                return self
        return MockSupabaseClient()
    
    try:
        return create_client(url, key)
    except Exception as e:
        logger.exception("Failed to connect to Supabase: %s", str(e))
        class MockSupabaseClient:
            def __getattr__(self, name):
                return self
            def execute(self, *args, **kwargs):
                class MockResponse:
                    data = []
                return MockResponse()
            def __call__(self, *args, **kwargs):
                return self
        return MockSupabaseClient()

supabase = get_supabase()

def get_user_id_from_auth(auth_header: str | None) -> str:
    default_id = "00000000-0000-0000-0000-000000000000"
    if not auth_header or not auth_header.startswith("Bearer "):
        return default_id
    
    token = auth_header.split(" ")[1]
    
    # If using mock supabase credentials, bypass real API call
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or "mock" in url or not key or "mock" in key:
        return default_id
        
    try:
        user_res = supabase.auth.get_user(token)
        if user_res and hasattr(user_res, "user") and user_res.user:
            return user_res.user.id
    except Exception as e:
        logger.warning("Failed to retrieve user from auth token: %s", e)
    return default_id

def get_user_contact_info(user_id: str) -> dict:
    """
    Retrieves user contact info (email, name, phone) from the profiles table,
    falling back to Supabase Auth Admin API if columns are empty or profiles query has no match.
    """
    info = {
        "email": "customer@example.com",
        "name": "Customer",
        "phone": ""
    }
    if not user_id:
        return info

    # If using mock supabase credentials, bypass real API call
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or "mock" in url or not key or "mock" in key:
        return info

    # 1. Try querying profiles table
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            profile = res.data[0]
            info["email"] = profile.get("email") or info["email"]
            info["name"] = profile.get("name") or profile.get("full_name") or info["name"]
            info["phone"] = profile.get("phone") or ""
    except Exception as e:
        logger.error("Failed to query profiles table for user %s: %s", user_id, e)

    # 2. Fall back to Supabase Auth Admin API if email is default/empty/missing
    if info["email"] == "customer@example.com" or not info["email"]:
        try:
            auth_user = supabase.auth.admin.get_user_by_id(user_id)
            if auth_user and auth_user.user:
                info["email"] = auth_user.user.email or info["email"]
                meta = auth_user.user.user_metadata or {}
                info["name"] = meta.get("full_name") or meta.get("name") or info["name"]
                info["phone"] = auth_user.user.phone or info["phone"]
        except Exception as e:
            logger.error("Failed to fetch user from Supabase auth admin for user %s: %s", user_id, e)

    return info

