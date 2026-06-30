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
            "event_date": req.event_date,
            "event_location": req.event_location,
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
def get_order(order_id: str):
    """
    Retrieves the details of a specific order.
    """
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if res.data:
            return res.data[0]
        else:
            raise HTTPException(status_code=404, detail="Order not found in database.")
    except Exception as e:
        logger.exception("Failed to retrieve order details")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to query order", "code": "ORDER_QUERY_ERROR", "status": 400}
        )

@router.get("")
def list_orders(status: Optional[str] = None):
    """
    Lists orders, optionally filtered by status.
    """
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
def update_shipping(order_id: str, req: OrderShippingUpdateRequest):
    """
    Updates the shipping info for an order.
    """
    try:
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
    except Exception as e:
        logger.exception("Failed to update shipping information")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to update order shipping address", "code": "SHIPPING_UPDATE_ERROR", "status": 400}
        )

@router.put("/{order_id}/status")
def update_status(order_id: str, req: OrderUpdateStatusRequest):
    """
    Updates status of an order.
    """
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
