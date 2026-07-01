import asyncio
import logging
import os
import datetime
import uuid
from dotenv import load_dotenv

# Load dotenv relative to the backend root directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

from utils.queue import get_queue
from utils.supabase_client import supabase
from services.photo_selector import run_full_pipeline
from services import s3_service
from services.notifications import send_order_confirmation_email, send_gallery_ready_email, send_gallery_ready_whatsapp, send_review_ready_email, send_review_ready_whatsapp, send_gallery_auto_published_email, send_gallery_auto_published_whatsapp

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

TIER_TARGETS = {
    "free": 20,
    "basic": 80,
    "premium": 200,
    "photographer": 500
}

async def process_job(job):
    """
    Background worker that runs the full gallery generation flow.
    """
    order_id = job.data.get("order_id")
    batch_id = job.data.get("batch_id")
    
    logger.info("Starting background gallery compilation task. Order ID: %s, Batch ID: %s", order_id, batch_id)
    
    if not order_id and batch_id:
        try:
            batch_res = supabase.table("photo_batches").select("order_id").eq("id", batch_id).execute()
            if batch_res.data:
                order_id = batch_res.data[0]["order_id"]
        except Exception as e:
            logger.error("DB error fetching order_id from batch: %s", e)
            
    if not batch_id and order_id:
        try:
            batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
            if batch_res.data:
                batch_id = batch_res.data[0]["id"]
        except Exception as e:
            logger.error("DB error fetching batch_id from order: %s", e)
            
    if not order_id or not batch_id:
        logger.error("Failed to run task: missing order_id or batch_id")
        return
        
    # 1. Fetch event settings and tier from database
    event_name = "My Event"
    event_type = "wedding"
    caption_style = "cinematic"
    language = "English"
    tier = "free"
    slug = ""
    ord_data = None
    
    try:
        ord_res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if ord_res.data:
            ord_data = ord_res.data[0]
            event_name = ord_data.get("event_name") or ord_data.get("book_title") or "My Event"
            event_type = ord_data.get("book_type") or "wedding"
            caption_style = ord_data.get("caption_style", "cinematic")
            language = ord_data.get("language", "English")
            tier = ord_data.get("tier", "free").lower()
            slug = ord_data.get("event_slug")
    except Exception as e:
        logger.error("Failed to fetch order configurations: %s", e)

    if not slug:
        slug = f"event-{uuid.uuid4().hex[:8]}"
        try:
            supabase.table("orders").update({"event_slug": slug}).eq("id", order_id).execute()
        except Exception:
            pass

    target_count = TIER_TARGETS.get(tier, 20)

    # 2. Update status to running
    try:
        supabase.table("photo_batches").update({
            "ai_status": "running",
            "ai_progress": 20
        }).eq("id", batch_id).execute()
        supabase.table("orders").update({
            "status": "processing"
        }).eq("id", order_id).execute()
    except Exception as e:
        logger.error("DB error updating status: %s", e)

    # 3. Retrieve batch S3 keys
    image_paths = []
    try:
        photos = supabase.table("photos").select("s3_key").eq("batch_id", batch_id).execute()
        if photos.data:
            image_paths = [p["s3_key"] for p in photos.data]
    except Exception as e:
        logger.error("DB error fetching photos: %s", e)

    if not image_paths:
        logger.warning("No photos uploaded for batch %s", batch_id)
        return

    # 4. Run AI Pipeline
    logger.info("Executing curation pipeline on %d photos...", len(image_paths))
    result = await asyncio.wait_for(
        run_full_pipeline(
            image_paths=image_paths,
            target_count=target_count,
            event_type=event_type,
            caption_style=caption_style,
            language=language,
            event_name=event_name,
            order_id=order_id
        ),
        timeout=600.0
    )

    # 5. Drop previous moments & face clusters to avoid duplication
    try:
        supabase.table("gallery_moments").delete().eq("order_id", order_id).execute()
        supabase.table("face_clusters").delete().eq("order_id", order_id).execute()
    except Exception as e:
        logger.error("DB error clearing old records: %s", e)

    # 6. Save moments to DB
    moments = result.get("chapters", [])
    moment_ids = []
    for idx, moment in enumerate(moments):
        try:
            m_res = supabase.table("gallery_moments").insert({
                "order_id": order_id,
                "name": moment["title"],
                "display_order": idx
            }).execute()
            if m_res.data:
                moment_ids.append(m_res.data[0]["id"])
            else:
                moment_ids.append(None)
        except Exception as e:
            logger.error("Failed to insert moment %s: %s", moment["title"], e)
            moment_ids.append(None)

    # 7. Update photos with caption and moment IDs
    logger.info("Saving selected photos metadata...")
    for idx, photo in enumerate(result["selected_photos"]):
        try:
            m_idx = photo["chapter"]
            mom_id = moment_ids[m_idx] if m_idx < len(moment_ids) else None
            
            # Extract key face ids
            face_ids = photo.get("face_cluster_ids") or []
            
            supabase.table("photos").update({
                "is_selected": True,
                "sequence_index": idx,
                "caption_v2": photo["caption"],
                "visual_analysis": photo["visual_analysis"],
                "face_cluster_ids": face_ids,
                "moment_id": mom_id,
                "scene_label": photo.get("scene") or "candid"
            }).eq("s3_key", photo["path"]).eq("batch_id", batch_id).execute()
        except Exception as e:
            logger.error("DB error updating selected photo: %s", e)

    # 8. Save face clusters to DB
    clusters = result.get("face_clusters", [])
    for cluster in clusters:
        try:
            # Resolve photo ID for representative crop if possible
            supabase.table("face_clusters").insert({
                "order_id": order_id,
                "cluster_index": cluster["cluster_index"],
                "representative_face_crop_s3": cluster["face_crop_s3"],
                "photo_count": cluster["photo_count"]
            }).execute()
        except Exception as e:
            logger.error("Failed to insert face cluster index %s: %s", cluster["cluster_index"], e)

    # 9. Format gallery live URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    share_url = f"{frontend_url}/e/{slug}"

    # 10. Finalize order details
    try:
        # Expiry time based on tier: 7 days for free, 365 days for basic
        expires_at = None
        if tier == "free":
            expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)).isoformat()
        elif tier == "basic":
            expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)).isoformat()

        # Calculate review deadline (24 hours from now)
        review_deadline = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)

        supabase.table("photo_batches").update({
            "ai_status": "completed",
            "ai_progress": 100,
            "pipeline_result": result
        }).eq("id", batch_id).execute()

        supabase.table("orders").update({
            "status": "review_ready",
            "share_url": share_url,
            "gallery_live": False,
            "review_deadline": review_deadline.isoformat(),
            "pipeline_completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "pipeline_duration_seconds": result.get("processing_time_seconds"),
            "expires_at": expires_at
        }).eq("id", order_id).execute()
    except Exception as e:
        logger.error("Failed to finalize order status in DB: %s", e)

    # 11. Send review-ready notification emails & whatsapp messages
    user_email = "customer@example.com"
    user_name = "Customer"
    user_phone = ""
    try:
        if ord_data and ord_data.get("user_id"):
            user_res = supabase.table("profiles").select("*").eq("id", ord_data["user_id"]).execute()
            if user_res.data:
                user_email = user_res.data[0].get("email") or user_email
                user_name = user_res.data[0].get("name") or user_name
                user_phone = user_res.data[0].get("phone") or ""
    except Exception as e:
        logger.error("Failed to fetch user profiles for notifications: %s", e)

    frontend_url_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    review_url = f"{frontend_url_base}/dashboard/gallery/{slug}/review"
    review_deadline_str = ""
    try:
        review_deadline_str = review_deadline.strftime("%d %B %Y, %I:%M %p UTC")
    except Exception:
        pass

    try:
        stats_text = f"<p style='color: #a89f94; text-align: center; font-size: 14px;'>{len(result['selected_photos'])} Photos · {len(moments)} Moments · {len(clusters)} Faces grouped</p>"
        send_review_ready_email(
            order_id=order_id,
            recipient_email=user_email,
            recipient_name=user_name,
            event_name=event_name,
            review_url=review_url,
            stats_text=stats_text,
            review_deadline=review_deadline_str
        )
        if user_phone:
            send_review_ready_whatsapp(user_phone, user_name, event_name, review_url)
    except Exception as ne:
        logger.error("Failed to send review ready alerts: %s", ne)

    # 12. Schedule auto-publish job for 24 hours later
    try:
        queue = get_queue("ai-pipeline")
        queue.add("auto-publish", {"order_id": order_id}, delay_seconds=24 * 60 * 60)
        logger.info("Scheduled auto-publish job for order %s in 24 hours", order_id)
    except Exception as e:
        logger.error("Failed to schedule auto-publish job: %s", e)

    logger.info("Background gallery compilation task complete. Gallery review URL: %s", review_url)

async def handle_auto_publish(job):
    """
    Auto-publishes a gallery if the user hasn't manually published within the review deadline.
    """
    order_id = job.data.get("order_id")
    if not order_id:
        logger.error("Auto-publish job missing order_id")
        return

    try:
        order_res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if not order_res.data:
            logger.info("Auto-publish: Order %s not found — skipping", order_id)
            return

        order = order_res.data[0]

        if order["status"] == "published":
            logger.info("Order %s already published by user — skipping auto-publish", order_id)
            return

        if order["status"] != "review_ready":
            logger.info("Order %s not in review_ready state (status=%s) — skipping auto-publish", order_id, order["status"])
            return

        # Auto-publish the gallery
        supabase.table("orders").update({
            "status": "published",
            "gallery_live": True,
            "published_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "auto_published": True
        }).eq("id", order_id).execute()

        logger.info("Auto-published gallery for order %s", order_id)

        # Send "your gallery is now live" notifications
        event_name = order.get("event_name") or "My Event"
        slug = order.get("event_slug") or ""
        share_url = order.get("share_url") or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/e/{slug}"

        user_email = "customer@example.com"
        user_name = "Customer"
        user_phone = ""
        try:
            user_res = supabase.table("profiles").select("*").eq("id", order["user_id"]).execute()
            if user_res.data:
                user_email = user_res.data[0].get("email") or user_email
                user_name = user_res.data[0].get("name") or user_name
                user_phone = user_res.data[0].get("phone") or ""
        except Exception as e:
            logger.error("Failed to fetch user profile for auto-publish notification: %s", e)

        try:
            send_gallery_auto_published_email(
                order_id=order_id,
                recipient_email=user_email,
                recipient_name=user_name,
                event_name=event_name,
                share_url=share_url
            )
            if user_phone:
                send_gallery_auto_published_whatsapp(user_phone, event_name, share_url)
        except Exception as ne:
            logger.error("Failed to send auto-publish notifications: %s", ne)

    except Exception as e:
        logger.error("Auto-publish job failed for order %s: %s", order_id, e)


async def cleanup_expired_trials_task():
    while True:
        try:
            logger.info("Running expired trial sessions cleanup job...")
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            expired_res = supabase.table("trial_sessions") \
                .select("id", "s3_prefix") \
                .eq("status", "ready") \
                .lt("expires_at", now) \
                .execute()
                
            if expired_res.data:
                for session in expired_res.data:
                    session_id = session["id"]
                    s3_prefix = session["s3_prefix"]
                    logger.info("Cleaning up expired trial session: %s", session_id)
                    if s3_prefix:
                        try:
                            s3_client = s3_service.get_s3_client()
                            if s3_client:
                                bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
                                response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=s3_prefix)
                                if "Contents" in response:
                                    delete_keys = [{"Key": obj["Key"]} for obj in response["Contents"]]
                                    s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": delete_keys})
                        except Exception as s3_err:
                            logger.error("Failed to delete S3 files: %s", s3_err)
                    supabase.table("trial_sessions").update({"status": "expired"}).eq("id", session_id).execute()
        except Exception as e:
            logger.error("Error in cleanup_expired_trials_task: %s", e)
        await asyncio.sleep(3600)

async def main():
    queue = get_queue("ai-pipeline")
    queue.process("ai-pipeline", process_job)
    queue.process("generate-book", process_job)
    queue.process("auto-publish", handle_auto_publish)
    asyncio.create_task(cleanup_expired_trials_task())
    await queue.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped.")
