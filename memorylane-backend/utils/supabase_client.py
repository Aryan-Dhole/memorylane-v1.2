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
