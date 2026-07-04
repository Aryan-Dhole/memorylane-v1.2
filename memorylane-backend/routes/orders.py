import logging
import datetime
import os
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import List, Optional

from models.schemas import (
    OrderCreateRequest, OrderUpdateStatusRequest, OrderShippingUpdateRequest
)
from utils.supabase_client import supabase

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "memorylane2026")

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("")
def create_order(req: OrderCreateRequest, authorization: Optional[str] = Header(None)):
    """
    Creates a new photo book order in 'draft' status.
    """
    logger.info("Creating digital order for book title: %s, tier: %s", req.book_title, req.tier)
    try:
        from utils.supabase_client import get_user_id_from_auth
        user_id = get_user_id_from_auth(authorization)
        if user_id == "00000000-0000-0000-0000-000000000000":
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required. Your session may have expired or you are not logged in. Please log in first.", "code": "UNAUTHORIZED", "status": 401}
            )
        
        # Determine book type and event type
        book_type = req.book_type or req.event_type or "classic"
        
        # Calculate price and page count based on digital tiers
        tier_lower = req.tier.lower()
        if tier_lower == "free":
            total_price = 0
            page_count = 20
        elif tier_lower == "premium":
            total_price = 99900
            page_count = 200
        elif tier_lower == "photographer":
            total_price = 199900
            page_count = 500
        else:  # basic (default)
            total_price = 49900
            page_count = 80
            
        import uuid
        import re
        share_token = str(uuid.uuid4())
        
        # Generate slug
        clean_name = req.event_name or req.book_title or "my-event"
        slug_base = clean_name.lower().strip()
        slug_base = re.sub(r'[^\w\s-]', '', slug_base)
        slug_base = re.sub(r'[\s_-]+', '-', slug_base)
        event_slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"
        
        # Sanitize empty strings to None (SQL NULL) to avoid Postgrest date parsing errors
        event_date = req.event_date.strip() if req.event_date and req.event_date.strip() else None
        event_location = req.event_location.strip() if req.event_location and req.event_location.strip() else None

        order_data = {
            "user_id": user_id,
            "status": "draft",
            "book_type": book_type,
            "tier": req.tier,
            "page_count": page_count,
            "total_price": total_price,
            "caption_style": req.caption_style,
            "language": req.language,
            "book_title": req.event_name or req.book_title or "My Event",
            "event_name": req.event_name or req.book_title or "My Event",
            "event_date": event_date,
            "event_location": event_location,
            "event_slug": event_slug,
            "share_token": share_token
        }
        
        res = supabase.table("orders").insert(order_data).execute()
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=500, detail="Failed to log order record in database.")
    except Exception as e:
        logger.exception("Failed to create order")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to create order record", "code": "ORDER_CREATE_ERROR", "status": 400}
        )

@router.get("/{order_id}")
def get_order(order_id: str, authorization: Optional[str] = Header(None)):
    """
    Retrieves the details of a specific order. Scoped to the owner.
    """
    from utils.supabase_client import get_user_id_from_auth
    user_id = get_user_id_from_auth(authorization)
    
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if res.data:
            order = res.data[0]
            if order["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorized to access this order.")
            return order
        else:
            raise HTTPException(status_code=404, detail="Order not found in database.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to retrieve order details")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to query order", "code": "ORDER_QUERY_ERROR", "status": 400}
        )

@router.get("")
def list_orders(status: Optional[str] = None, x_admin_password: Optional[str] = Header(None)):
    """
    Lists orders, optionally filtered by status. Securely checks admin password.
    """
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Not authorized as administrator")
    try:
        query = supabase.table("orders").select("*")
        if status:
            query = query.eq("status", status)
        res = query.order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        logger.exception("Failed to retrieve list of orders")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to query list of orders", "code": "ORDER_LIST_ERROR", "status": 400}
        )

@router.put("/{order_id}/shipping")
def update_shipping(order_id: str, req: OrderShippingUpdateRequest, authorization: Optional[str] = Header(None)):
    """
    Updates the shipping info for an order. Scoped to the owner.
    """
    from utils.supabase_client import get_user_id_from_auth
    user_id = get_user_id_from_auth(authorization)
    
    try:
        # Check order ownership
        ord_res = supabase.table("orders").select("user_id").eq("id", order_id).execute()
        if not ord_res.data:
            raise HTTPException(status_code=404, detail="Order not found")
        if ord_res.data[0]["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this order")
            
        # Calculate mock estimated delivery (e.g. 5 days from now)
        est_delivery = (datetime.date.today() + datetime.timedelta(days=5)).isoformat()
        
        update_data = {
            "shipping_name": req.shipping_name,
            "shipping_address": req.shipping_address,
            "shipping_city": req.shipping_city,
            "shipping_pincode": req.shipping_pincode,
            "shipping_phone": req.shipping_phone,
            "estimated_delivery": est_delivery
        }
        
        res = supabase.table("orders").update(update_data).eq("id", order_id).execute()
        if res.data:
            return res.data[0]
        else:
            raise HTTPException(status_code=404, detail="Order not found for shipping update.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update shipping information")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to update order shipping address", "code": "SHIPPING_UPDATE_ERROR", "status": 400}
        )

@router.put("/{order_id}/status")
def update_status(order_id: str, req: OrderUpdateStatusRequest, x_admin_password: Optional[str] = Header(None)):
    """
    Updates status of an order. Securely checks admin password.
    """
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Not authorized as administrator")
    try:
        res = supabase.table("orders").update({"status": req.status}).eq("id", order_id).execute()
        if res.data:
            return res.data[0]
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "Order to update status not found", "code": "ORDER_NOT_FOUND", "status": 404}
            )
    except Exception as e:
        logger.exception("Failed to update order status")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to update order status", "code": "STATUS_UPDATE_ERROR", "status": 400}
        )

@router.delete("/{order_id}")
def delete_order(order_id: str, authorization: Optional[str] = Header(None)):
    """
    Deletes the order, S3 uploaded files, and all associated database records (via cascade).
    Scoped to the owner of the order.
    """
    from utils.supabase_client import get_user_id_from_auth
    from services import s3_service
    user_id = get_user_id_from_auth(authorization)
    
    try:
        # 1. Verify ownership of the order
        ord_res = supabase.table("orders").select("user_id").eq("id", order_id).execute()
        if not ord_res.data:
            raise HTTPException(status_code=404, detail="Order not found")
        if ord_res.data[0]["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this order")
            
        # 2. Delete uploaded S3 files first (if batch exists)
        batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
        if batch_res.data:
            batch_id = batch_res.data[0]["id"]
            # Delete S3 prefix: uploads/{user_id}/{batch_id}
            s3_service.delete_batch(f"uploads/{user_id}/{batch_id}")
            
        # 3. Delete the order record (PostgreSQL CASCADE will clean up orders, photos, and batches)
        supabase.table("orders").delete().eq("id", order_id).execute()
        
        return {"success": True, "message": "Order and all associated data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete order")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to delete order", "code": "ORDER_DELETE_ERROR", "status": 400}
        )
