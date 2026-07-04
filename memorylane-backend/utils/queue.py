import json
import logging
import asyncio
import os
import redis
from typing import Dict, Callable, Any

logger = logging.getLogger(__name__)

class MockJob:
    def __init__(self, data: dict):
        self.data = data

class SimpleRedisQueue:
    def __init__(self, name: str):
        self.name = name
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.use_redis = False
        self.handlers: Dict[str, Callable] = {}
        self.memory_queue: asyncio.Queue = asyncio.Queue()
        
        try:
            self.client = redis.Redis.from_url(self.redis_url, socket_connect_timeout=2.0)
            # Test connection
            self.client.ping()
            self.use_redis = True
            logger.info("Connected to Redis queue successfully at %s", self.redis_url)
        except Exception:
            logger.warning("Redis is offline or not configured. Falling back to in-memory queue.")
            self.client = None

    def add(self, task_name: str, data: dict, delay_seconds: int = 0):
        """Add a job to the queue. If delay_seconds > 0, the job will be delayed."""
        job_data = {"task_name": task_name, "data": data}
        
        if delay_seconds > 0:
            # For delayed jobs, use asyncio.create_task with sleep
            async def _delayed_add():
                await asyncio.sleep(delay_seconds)
                self._enqueue_now(job_data)
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(_delayed_add())
                    logger.info("Scheduled delayed job %s on queue %s in %d seconds", task_name, self.name, delay_seconds)
                    return
            except RuntimeError:
                pass
            # Fallback: enqueue immediately if we can't schedule
            logger.warning("Could not schedule delayed job, enqueueing immediately: %s", task_name)
        
        self._enqueue_now(job_data)
    
    def _enqueue_now(self, job_data: dict):
        """Internal: immediately enqueue a job."""
        task_name = job_data.get("task_name", "unknown")
        if self.use_redis and self.client:
            try:
                self.client.rpush(f"queue:{self.name}", json.dumps(job_data))
                logger.info("Added job to Redis queue %s: %s", self.name, job_data.get("data"))
                return
            except Exception as e:
                logger.error("Failed to add job to Redis, writing to memory queue: %s", str(e))
        
        # In-memory fallback
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            loop.create_task(self.memory_queue.put(job_data))
        else:
            loop.run_until_complete(self.memory_queue.put(job_data))
        logger.info("Added job to in-memory queue %s: %s", self.name, job_data.get("data"))

    def process(self, task_name: str, handler: Callable):
        """Register a processing handler for a specific task type."""
        self.handlers[task_name] = handler
        logger.info("Registered handler for task %s on queue %s", task_name, self.name)

    async def run(self):
        """Main worker loop that processes jobs."""
        logger.info("Starting worker for queue: %s", self.name)
        while True:
            job_data = None
            if self.use_redis and self.client:
                try:
                    # Non-blocking pop in a loop to allow cooperative multitasking/signals
                    # blpop blocks, but redis-py allows timeout
                    result = self.client.blpop(f"queue:{self.name}", timeout=1)
                    if result:
                        _, val = result
                        job_data = json.loads(val.decode("utf-8"))
                except Exception as e:
                    logger.error("Redis queue error: %s", str(e))
                    await asyncio.sleep(2)
            else:
                # In-memory processing
                try:
                    job_data = await asyncio.wait_for(self.memory_queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    pass
            
            if job_data:
                task_name = job_data.get("task_name")
                data = job_data.get("data")
                handler = self.handlers.get(task_name)
                
                if handler:
                    try:
                        logger.info("Processing task: %s with data: %s", task_name, data)
                        job = MockJob(data)
                        if asyncio.iscoroutinefunction(handler):
                            await handler(job)
                        else:
                            handler(job)
                        logger.info("Successfully finished task: %s", task_name)
                    except Exception as e:
                        logger.error("Failed to process job %s: %s", task_name, str(e))
                        retries = job_data.get("retries", 0)
                        if retries < 2:  # 3 total attempts (0, 1, 2)
                            job_data["retries"] = retries + 1
                            if self.use_redis and self.client:
                                self.client.rpush(f"queue:{self.name}", json.dumps(job_data))
                            else:
                                await self.memory_queue.put(job_data)
                            logger.info("Re-queued job %s (attempt %d/3)", task_name, retries + 2)
                        else:
                            failed_job_data = {"job": job_data, "error": str(e)}
                            if self.use_redis and self.client:
                                self.client.rpush("queue:failed-jobs", json.dumps(failed_job_data))
                            logger.error("Job %s exceeded max retries. Moved to failed-jobs.", task_name)
                            
                            # Clean up order, trigger refund, and notify customer
                            try:
                                order_id = data.get("order_id") if isinstance(data, dict) else None
                                if order_id:
                                    from utils.supabase_client import supabase
                                    supabase.table("orders").update({"status": "failed"}).eq("id", order_id).execute()
                                    
                                    batch_id = data.get("batch_id")
                                    if batch_id:
                                        supabase.table("photo_batches").update({"ai_status": "failed", "ai_progress": 0}).eq("id", batch_id).execute()
                                        
                                    from services.refund_service import issue_full_refund
                                    await issue_full_refund(order_id)
                                    
                                    # Fetch customer info
                                    ord_res = supabase.table("orders").select("*").eq("id", order_id).execute()
                                    if ord_res.data:
                                        ord_data = ord_res.data[0]
                                        user_id = ord_data["user_id"]
                                        user_phone = ord_data.get("shipping_phone") or ""
                                        total_price_rs = ord_data.get("total_price", 0) / 100.0
                                        
                                        from utils.supabase_client import get_user_contact_info
                                        contact_info = get_user_contact_info(user_id)
                                        user_name = contact_info["name"]
                                        user_email = contact_info["email"]
                                        
                                        from services.notifications import send_user_pipeline_failed_email, send_pipeline_failed_whatsapp
                                        send_user_pipeline_failed_email(user_email, user_name, total_price_rs)
                                        if user_phone:
                                            send_pipeline_failed_whatsapp(user_phone, user_name)
                            except Exception as fail_err:
                                logger.error("Failed to run post-failure cleanup/refund: %s", fail_err)
                                
                            try:
                                from services.notifications import send_admin_failed_job_alert
                                send_admin_failed_job_alert(failed_job_data)
                            except Exception as alert_err:
                                logger.error("Failed to send admin DLQ alert: %s", alert_err)
                    else:
                        logger.warning("No handler found for task %s", task_name)
                    
            await asyncio.sleep(0.1)

# Global queue registry to share instances
_queues = {}

def get_queue(name: str) -> SimpleRedisQueue:
    if name not in _queues:
        _queues[name] = SimpleRedisQueue(name)
    return _queues[name]
