import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load dotenv relative to the backend root directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

if os.getenv("ENV") == "production" and os.getenv("MOCK_MODE") == "true":
    raise RuntimeError(
        "FATAL: MOCK_MODE is enabled in production. Refusing to start. "
        "This would serve fake data to real users."
    )


# Sentry initialization if DSN is provided
if os.getenv("SENTRY_DSN"):
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=os.getenv("SENTRY_DSN"),
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
        print("Sentry initialized successfully.")
    except ImportError:
        print("sentry-sdk not installed, skipping sentry initialization.")

from utils.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

import time
import logging
from fastapi import Request

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — replaces deprecated on_event startup/shutdown."""
    # --- STARTUP ---
    from utils.queue import get_queue
    queue = get_queue("ai-pipeline")
    if not queue.use_redis:
        import asyncio
        from worker import process_job, cleanup_expired_trials_task, handle_auto_publish
        queue.process("ai-pipeline", process_job)
        queue.process("generate-book", process_job)
        queue.process("auto-publish", handle_auto_publish)
        asyncio.create_task(queue.run())
        asyncio.create_task(cleanup_expired_trials_task())
        logger.info("Redis is offline. Started in-app queue worker & trial cleaner background tasks.")

    yield

    # --- SHUTDOWN ---
    queue = get_queue("ai-pipeline")
    if queue.use_redis and queue.client:
        queue.client.close()
        logger.info("Gracefully closed Redis client connection.")


app = FastAPI(title="MemoryLane API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Build CORS origins list
is_production = os.getenv("ENV", "development").lower() == "production"
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
allowed_origins = [frontend_url]

# Dynamically support both apex and www subdomains for HTTPS production origins
if frontend_url.startswith("https://"):
    if "://www." in frontend_url:
        allowed_origins.append(frontend_url.replace("://www.", "://"))
    else:
        allowed_origins.append(frontend_url.replace("://", "://www."))

# Always allow main production domains
allowed_origins.extend([
    "https://memorylaneapps.in",
    "https://www.memorylaneapps.in"
])

# Parse additional comma-separated origins if provided
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins.extend([origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()])

# Local dev fallback origins
allowed_origins.extend([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
])

# Remove duplicates
allowed_origins = list(set(allowed_origins))

# Regex to allow any localhost/127.0.0.1, and any subdomain of memorylaneapps.in
origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://([a-zA-Z0-9-]+\.)*memorylaneapps\.in$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_time(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(
        "Request: %s %s - Status: %s - Duration: %.3fs",
        request.method,
        request.url.path,
        response.status_code,
        duration
    )
    if duration > 2.0:
        logger.warning("TODO: Optimize endpoint taking more than 2 seconds: %s", request.url.path)
    return response

# Import and include routers
from routes import upload, analyze, gallery, orders, payments, trial, photographer

app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(gallery.router, prefix="/gallery", tags=["gallery"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(trial.router, prefix="/trial", tags=["trial"])
app.include_router(photographer.router, prefix="/photographer", tags=["photographer"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "memorylane-api"}
