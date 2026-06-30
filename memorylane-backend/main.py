import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

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

app = FastAPI(title="MemoryLane API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import time
import logging
from fastapi import Request

@app.middleware("http")
async def log_request_time(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger = logging.getLogger("main")
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

@app.on_event("startup")
async def startup():
    from utils.queue import get_queue
    queue = get_queue("ai-pipeline")
    if not queue.use_redis:
        import asyncio
        from worker import process_job, cleanup_expired_trials_task
        queue.process("ai-pipeline", process_job)
        asyncio.create_task(queue.run())
        asyncio.create_task(cleanup_expired_trials_task())
        logger = logging.getLogger("main")
        logger.info("Redis is offline. Started in-app queue worker & trial cleaner background tasks.")

@app.on_event("shutdown")
async def shutdown():
    from utils.queue import get_queue
    queue = get_queue("ai-pipeline")
    if queue.use_redis and queue.client:
        queue.client.close()
        logger = logging.getLogger("main")
        logger.info("Gracefully closed Redis client connection.")
