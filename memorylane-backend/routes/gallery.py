import os
import json
import uuid
import logging
import datetime
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from utils.supabase_client import supabase, get_user_id_from_auth
from services import s3_service
from services.quality_scorer import score_image_quality
from utils.queue import get_queue
from utils.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

# Schema structures
class ReactRequest(BaseModel):
    photo_id: str
    reaction_type: str
    session_id: str

class GallerySettingsPatch(BaseModel):
    event_name: Optional[str] = None
    caption_style: Optional[str] = None
    allow_guest_uploads: Optional[bool] = None
    allow_reactions: Optional[bool] = None
    gallery_password: Optional[str] = None

# Background task to increment views async
def increment_views_task(slug: str, current_views: int):
    try:
        supabase.table("orders").update({"view_count": current_views + 1}).eq("event_slug", slug).execute()
    except Exception as e:
        logger.error("Failed to increment gallery view count: %s", e)

# Redis helper
def get_redis_client():
    try:
        q = get_queue("ai-pipeline")
        if q.use_redis and q.client:
            return q.client
    except Exception:
        pass
    return None

def invalidate_gallery_cache(slug: str):
    rc = get_redis_client()
    if rc:
        try:
            rc.delete(f"gallery:{slug}")
            logger.info("Invalidated Redis cache for gallery: %s", slug)
        except Exception as e:
            logger.error("Failed to delete Redis cache: %s", e)

@router.get("/{slug}")
@limiter.limit("60/minute")
def get_gallery_details(request: Request, slug: str, background_tasks: BackgroundTasks):
    """
    Public gallery retrieval endpoint. No auth required.
    Cached in Redis for 5 minutes.
    """
    cache_key = f"gallery:{slug}"
    rc = get_redis_client()
    if rc:
        try:
            cached = rc.get(cache_key)
            if cached:
                logger.info("Serving gallery payload from Redis cache: %s", slug)
                data = json.loads(cached)
                # Increment views async
                background_tasks.add_task(increment_views_task, slug, data.get("view_count", 0))
                return data
        except Exception as e:
            logger.error("Redis cache read error: %s", e)

    # Fetch event/order record
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event gallery not found")
    
    event = event_res.data[0]
    
    # Check if gallery is published (publicly accessible)
    if not event.get("gallery_live"):
        if event.get("status") == "review_ready":
            raise HTTPException(
                status_code=403,
                detail="This gallery is not yet published. The creator is reviewing it."
            )
        raise HTTPException(status_code=404, detail="Event gallery not found")
    
    # Check if gallery has expired
    expires_at_str = event.get("expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=410, 
                    detail="This gallery link has expired (7-day limit for Free, 365-day limit for Basic)."
                )
        except ValueError:
            pass
    order_id = event["id"]
    
    # Get associated batch
    batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
    if not batch_res.data:
        raise HTTPException(status_code=404, detail="Photo batch not configured for this event")
        
    batch_id = batch_res.data[0]["id"]
    
    # Fetch moments
    moments_res = supabase.table("gallery_moments").select("*").eq("order_id", order_id).order("display_order").execute()
    moments_list = moments_res.data or []
    
    # If no moments created yet, create a default one
    if not moments_list:
        try:
            insert_res = supabase.table("gallery_moments").insert({
                "order_id": order_id,
                "name": "Highlights",
                "display_order": 0
            }).execute()
            if insert_res.data:
                moments_list = insert_res.data
        except Exception:
            moments_list = [{"id": None, "name": "Highlights", "display_order": 0}]

    # Fetch selected photos
    photos_res = supabase.table("photos") \
        .select("*") \
        .eq("batch_id", batch_id) \
        .eq("is_selected", True) \
        .order("sequence_index") \
        .execute()
    
    photos_data = photos_res.data or []
    photo_ids = [p["id"] for p in photos_data]
    
    # Fetch reactions counts
    reactions_dict = {}
    if photo_ids:
        try:
            react_res = supabase.table("photo_reactions").select("photo_id, reaction_type").in_("photo_id", photo_ids).execute()
            for r in (react_res.data or []):
                p_id = r["photo_id"]
                r_type = r["reaction_type"]
                if p_id not in reactions_dict:
                    reactions_dict[p_id] = {"heart": 0, "laugh": 0, "cry": 0, "wow": 0}
                if r_type in reactions_dict[p_id]:
                    reactions_dict[p_id][r_type] += 1
        except Exception as e:
            logger.error("Failed to query reactions: %s", e)

    # Format moments payload
    moments_payload = []
    for idx, moment in enumerate(moments_list):
        m_id = moment.get("id")
        # Filter photos belonging to this moment or index
        m_photos = []
        for p in photos_data:
            # Check if moment_id matches
            is_match = False
            if m_id and p.get("moment_id") == m_id:
                is_match = True
            elif not p.get("moment_id") and idx == p.get("chapter_index", 0):
                is_match = True
                
            if is_match:
                p_id = p["id"]
                caption = p.get("caption_edited") or p.get("caption_v2") or p.get("caption") or ""
                m_photos.append({
                    "id": p_id,
                    "url": s3_service.generate_download_url(p["s3_key"]),
                    "thumb_url": s3_service.generate_download_url(p["s3_key"], expires_in=3600),
                    "caption": caption,
                    "face_cluster_ids": p.get("face_cluster_ids") or [],
                    "dominant_emotion": p.get("visual_analysis", {}).get("dominant_emotion") if p.get("visual_analysis") else "candid_unaware",
                    "reaction_counts": reactions_dict.get(p_id, {"heart": 0, "laugh": 0, "cry": 0, "wow": 0})
                })
                
        # Resolve moment cover image
        m_cover = ""
        if moment.get("cover_photo_id"):
            cov_photo = next((p for p in photos_data if p["id"] == moment["cover_photo_id"]), None)
            if cov_photo:
                m_cover = s3_service.generate_download_url(cov_photo["s3_key"])
        elif m_photos:
            m_cover = m_photos[0]["url"]
            
        moments_payload.append({
            "id": m_id or str(idx),
            "name": moment["name"],
            "display_order": moment["display_order"],
            "cover_photo_url": m_cover,
            "photos": m_photos
        })

    # Fetch face clusters
    clusters_res = supabase.table("face_clusters").select("*").eq("order_id", order_id).execute()
    clusters_payload = []
    for c in (clusters_res.data or []):
        crop_url = ""
        if c.get("representative_face_crop_s3"):
            crop_url = s3_service.generate_download_url(c["representative_face_crop_s3"])
            
        clusters_payload.append({
            "cluster_index": c["cluster_index"],
            "face_crop_url": crop_url,
            "photo_count": c.get("photo_count", 0)
        })

    # Event cover URL
    cover_url = ""
    if event.get("cover_photo_id") and photos_data:
        cov_photo = next((p for p in photos_data if p["id"] == event["cover_photo_id"]), None)
        if cov_photo:
            cover_url = s3_service.generate_download_url(cov_photo["s3_key"])
    elif moments_payload and moments_payload[0]["photos"]:
        cover_url = moments_payload[0]["photos"][0]["url"]

    response_payload = {
        "id": order_id,
        "event_name": event.get("event_name") or "My Event",
        "event_type": event.get("book_type") or "Wedding",
        "event_date": str(event.get("event_date")) if event.get("event_date") else "",
        "event_location": event.get("event_location") or "",
        "cover_photo_url": cover_url,
        "caption_style": event.get("caption_style", "cinematic"),
        "tier": event.get("tier") or "free",
        "moments": moments_payload,
        "face_clusters": clusters_payload,
        "allow_guest_uploads": event.get("allow_guest_uploads", False),
        "allow_reactions": event.get("allow_reactions", True),
        "total_photos": len(photos_data),
        "view_count": event.get("view_count", 0)
    }

    # Save to Redis
    if rc:
        try:
            rc.setex(cache_key, 300, json.dumps(response_payload))
        except Exception as e:
            logger.error("Redis write error: %s", e)

    # Increment view count async
    background_tasks.add_task(increment_views_task, slug, event.get("view_count", 0))

    return response_payload

@router.post("/{slug}/react")
def react_to_photo(slug: str, req: ReactRequest):
    """
    Public reaction registration. Upserts a unique reaction.
    """
    try:
        supabase.table("photo_reactions").upsert({
            "photo_id": req.photo_id,
            "reaction_type": req.reaction_type,
            "session_id": req.session_id
        }).execute()
        
        # Recalculate totals for this photo
        react_res = supabase.table("photo_reactions").select("reaction_type").eq("photo_id", req.photo_id).execute()
        counts = {"heart": 0, "laugh": 0, "cry": 0, "wow": 0}
        for r in (react_res.data or []):
            t = r["reaction_type"]
            if t in counts:
                counts[t] += 1
                
        # Invalidate page cache
        invalidate_gallery_cache(slug)
        
        return {"photo_id": req.photo_id, "reaction_counts": counts}
    except Exception as e:
        logger.error("Failed to register reaction: %s", e)
        raise HTTPException(status_code=500, detail="Reaction registration failed")

@router.post("/{slug}/upload")
async def upload_guest_photo(
    slug: str,
    uploader_name: str = Form("Guest"),
    session_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Guest photo upload. Auto-approves if quality score is high enough.
    """
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event gallery not found")
        
    event = event_res.data[0]
    order_id = event["id"]
    
    if not event.get("allow_guest_uploads", False):
        raise HTTPException(status_code=400, detail="Guest uploads are disabled for this gallery")
        
    # Check limit of 5 uploads per guest session
    existing_uploads_res = supabase.table("guest_uploads").select("id").eq("order_id", order_id).eq("uploader_session_id", session_id).execute()
    if len(existing_uploads_res.data or []) >= 5:
        raise HTTPException(status_code=400, detail="Maximum guest upload limit of 5 photos reached")

    # Read file
    content = await file.read()
    temp_filepath = f"temp_guest_{uuid.uuid4().hex}.jpg"
    with open(temp_filepath, "wb") as f:
        f.write(content)
        
    try:
        # Score quality
        quality_res = score_image_quality(temp_filepath)
        score = quality_res["final_quality_score"]
        
        # Save to S3 / local S3
        s3_key = f"uploads/guest/{order_id}/{uuid.uuid4().hex}.jpg"
        s3_client = s3_service.get_s3_client()
        if s3_client:
            bucket_name = os.getenv("S3_BUCKET_NAME", "memorylane-photos")
            s3_client.upload_file(temp_filepath, bucket_name, s3_key, ExtraArgs={"ContentType": "image/jpeg"})
        else:
            local_dest = os.path.join(s3_service.LOCAL_S3_DIR, s3_key)
            os.makedirs(os.path.dirname(local_dest), exist_ok=True)
            with open(local_dest, "wb") as f:
                f.write(content)

        # Quality threshold = 40 for auto-approval
        is_approved = score >= 40.0
        status = "approved" if is_approved else "pending"
        
        # Insert guest upload log
        supabase.table("guest_uploads").insert({
            "order_id": order_id,
            "uploader_name": uploader_name,
            "uploader_session_id": session_id,
            "s3_key": s3_key,
            "quality_score": score,
            "status": status,
            "approved_at": datetime.datetime.now(datetime.timezone.utc).isoformat() if is_approved else None
        }).execute()
        
        if is_approved:
            # Add to photos database linked to "Candid Magic" or default moment
            batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
            if batch_res.data:
                batch_id = batch_res.data[0]["id"]
                
                # Fetch moment "Candid Magic"
                mom_id = None
                m_res = supabase.table("gallery_moments").select("id").eq("order_id", order_id).eq("name", "Candid Magic").execute()
                if m_res.data:
                    mom_id = m_res.data[0]["id"]
                else:
                    # Create Candid Magic moment
                    new_m = supabase.table("gallery_moments").insert({
                        "order_id": order_id,
                        "name": "Candid Magic",
                        "display_order": 99
                    }).execute()
                    if new_m.data:
                        mom_id = new_m.data[0]["id"]
                
                # Retrieve current max sequence index
                seq_res = supabase.table("photos").select("sequence_index").eq("batch_id", batch_id).order("sequence_index", desc=True).limit(1).execute()
                next_seq = (seq_res.data[0]["sequence_index"] + 1) if seq_res.data else 0
                
                supabase.table("photos").insert({
                    "batch_id": batch_id,
                    "s3_key": s3_key,
                    "is_selected": True,
                    "sequence_index": next_seq,
                    "caption_v2": f"Uploaded by {uploader_name}",
                    "moment_id": mom_id
                }).execute()
                
                invalidate_gallery_cache(slug)

        return {
            "accepted": is_approved,
            "message": "Photo uploaded and approved!" if is_approved else "Photo submitted for review by the gallery owner."
        }
    finally:
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)

@router.get("/{slug}/my-photos/{cluster_index}")
def get_photos_for_face_cluster(slug: str, cluster_index: int):
    """
    Public face filter endpoint. Returns photos containing face_cluster_ids index.
    """
    event_res = supabase.table("orders").select("id").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event gallery not found")
        
    order_id = event_res.data[0]["id"]
    batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
    if not batch_res.data:
        raise HTTPException(status_code=404, detail="Batch index not configured")
        
    batch_id = batch_res.data[0]["id"]
    
    # Query matching photos
    photos_res = supabase.table("photos") \
        .select("*") \
        .eq("batch_id", batch_id) \
        .eq("is_selected", True) \
        .execute()
        
    matching_photos = []
    for p in (photos_res.data or []):
        c_ids = p.get("face_cluster_ids") or []
        if cluster_index in c_ids:
            caption = p.get("caption_edited") or p.get("caption_v2") or p.get("caption") or ""
            matching_photos.append({
                "id": p["id"],
                "url": s3_service.generate_download_url(p["s3_key"]),
                "thumb_url": s3_service.generate_download_url(p["s3_key"], expires_in=3600),
                "caption": caption
            })
            
    return {"photos": matching_photos, "cluster_photo_count": len(matching_photos)}

@router.get("/dashboard/galleries")
def get_user_dashboard_galleries(authorization: Optional[str] = Header(None)):
    """
    Secured owner dashboard fetch. Returns all galleries configured by user.
    """
    user_id = get_user_id_from_auth(authorization)
    
    events_res = supabase.table("orders") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
        
    galleries = []
    for ev in (events_res.data or []):
        # Fetch selected photos count
        p_count = 0
        batch_res = supabase.table("photo_batches").select("id").eq("order_id", ev["id"]).execute()
        if batch_res.data:
            p_res = supabase.table("photos").select("id", count="exact").eq("batch_id", batch_res.data[0]["id"]).eq("is_selected", True).execute()
            p_count = p_res.count or 0
            
        galleries.append({
            "id": ev["id"],
            "event_name": ev.get("event_name") or "Unnamed Event",
            "slug": ev.get("event_slug") or "",
            "status": ev.get("status", "draft"),
            "tier": ev.get("tier", "free"),
            "gallery_live": ev.get("gallery_live", False),
            "view_count": ev.get("view_count", 0),
            "photo_count": p_count,
            "created_at": ev.get("created_at"),
            "expires_at": ev.get("expires_at"),
            "review_deadline": ev.get("review_deadline"),
            "published_at": ev.get("published_at"),
            "auto_published": ev.get("auto_published", False),
            "share_url": ev.get("share_url")
        })
        
    return {"galleries": galleries}

@router.patch("/{slug}/settings")
def update_gallery_settings(slug: str, req: GallerySettingsPatch, authorization: Optional[str] = Header(None)):
    """
    Secured owner settings patching.
    """
    user_id = get_user_id_from_auth(authorization)
    
    # Check permissions
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event gallery not found")
        
    event = event_res.data[0]
    if event["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this gallery")
        
    update_data = {}
    if req.event_name is not None:
        update_data["event_name"] = req.event_name
    if req.caption_style is not None:
        update_data["caption_style"] = req.caption_style
    if req.allow_guest_uploads is not None:
        update_data["allow_guest_uploads"] = req.allow_guest_uploads
    if req.allow_reactions is not None:
        update_data["allow_reactions"] = req.allow_reactions
    if req.gallery_password is not None:
        update_data["gallery_password"] = req.gallery_password
        
    if update_data:
        supabase.table("orders").update(update_data).eq("id", event["id"]).execute()
        invalidate_gallery_cache(slug)
        
    return {"message": "Gallery settings updated successfully"}


# --- PUBLISH ENDPOINT ---
class PublishRequest(BaseModel):
    pass

@router.post("/{slug}/publish")
def publish_gallery(slug: str, authorization: Optional[str] = Header(None)):
    """
    Publishes a gallery that is in review_ready state. Makes it publicly accessible.
    """
    user_id = get_user_id_from_auth(authorization)
    
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    order = event_res.data[0]
    
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your gallery")
    
    if order["status"] not in ["review_ready"]:
        raise HTTPException(status_code=400, detail=f"Cannot publish gallery in '{order['status']}' state")
    
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    supabase.table("orders").update({
        "status": "published",
        "gallery_live": True,
        "published_at": now,
        "auto_published": False,
        "reviewed_at": now
    }).eq("id", order["id"]).execute()
    
    invalidate_gallery_cache(slug)
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return {
        "success": True,
        "gallery_url": f"{frontend_url}/e/{slug}",
        "message": "Your gallery is now live!"
    }


# --- REVIEW DATA ENDPOINT ---
@router.get("/{slug}/review")
def get_review_data(slug: str, authorization: Optional[str] = Header(None)):
    """
    Returns all photos (selected and unselected) for the gallery owner to review before publishing.
    """
    user_id = get_user_id_from_auth(authorization)
    
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    order = event_res.data[0]
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to review this gallery")
    
    if order["status"] not in ["review_ready", "published"]:
        raise HTTPException(status_code=400, detail=f"Gallery is in '{order['status']}' state and cannot be reviewed")
    
    order_id = order["id"]
    
    # Fetch batch
    batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
    if not batch_res.data:
        raise HTTPException(status_code=404, detail="Photo batch not found")
    batch_id = batch_res.data[0]["id"]
    
    # Fetch ALL photos (both selected and unselected)
    photos_res = supabase.table("photos").select("*").eq("batch_id", batch_id).order("sequence_index").execute()
    photos_data = photos_res.data or []
    
    # Fetch moments
    moments_res = supabase.table("gallery_moments").select("*").eq("order_id", order_id).order("display_order").execute()
    moments_list = moments_res.data or []
    
    # Format photos for review
    review_photos = []
    for p in photos_data:
        caption = p.get("caption_edited") or p.get("caption_v2") or p.get("caption") or ""
        review_photos.append({
            "id": p["id"],
            "url": s3_service.generate_download_url(p["s3_key"]),
            "thumb_url": s3_service.generate_download_url(p["s3_key"], expires_in=3600),
            "caption": caption,
            "is_selected": p.get("is_selected", False),
            "moment_id": p.get("moment_id"),
            "scene_label": p.get("scene_label", "candid"),
            "face_cluster_ids": p.get("face_cluster_ids") or [],
            "sequence_index": p.get("sequence_index", 0)
        })
    
    # Format moments
    review_moments = []
    for m in moments_list:
        review_moments.append({
            "id": m["id"],
            "name": m["name"],
            "display_order": m["display_order"]
        })
    
    return {
        "order_id": order_id,
        "event_name": order.get("event_name", "My Event"),
        "status": order["status"],
        "review_deadline": order.get("review_deadline"),
        "published_at": order.get("published_at"),
        "auto_published": order.get("auto_published", False),
        "tier": order.get("tier", "free"),
        "photos": review_photos,
        "moments": review_moments,
        "total_photos": len([p for p in review_photos if p["is_selected"]]),
        "total_uploaded": len(review_photos)
    }


# --- REVIEW PHOTO UPDATE ENDPOINT ---
class PhotoUpdate(BaseModel):
    photo_id: str
    is_selected: Optional[bool] = None
    caption_edited: Optional[str] = None

class ReviewPhotosUpdate(BaseModel):
    updates: List[PhotoUpdate]

@router.patch("/{slug}/review/photos")
def update_review_photos(slug: str, req: ReviewPhotosUpdate, authorization: Optional[str] = Header(None)):
    """
    Batch update photos during the review phase (toggle selection, edit captions).
    """
    user_id = get_user_id_from_auth(authorization)
    
    event_res = supabase.table("orders").select("*").eq("event_slug", slug).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    order = event_res.data[0]
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this gallery")
    
    if order["status"] not in ["review_ready", "published"]:
        raise HTTPException(status_code=400, detail=f"Gallery is in '{order['status']}' state and cannot be edited")
    
    updated_count = 0
    for update in req.updates:
        update_data = {}
        if update.is_selected is not None:
            update_data["is_selected"] = update.is_selected
        if update.caption_edited is not None:
            update_data["caption_edited"] = update.caption_edited
        
        if update_data:
            supabase.table("photos").update(update_data).eq("id", update.photo_id).execute()
            updated_count += 1
    
    invalidate_gallery_cache(slug)
    
    return {"success": True, "updated_count": updated_count}
