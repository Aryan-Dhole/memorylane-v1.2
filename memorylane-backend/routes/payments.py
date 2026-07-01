import os
import hmac
import hashlib
import logging
import uuid
import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from fastapi.responses import JSONResponse
from typing import List, Optional

from models.schemas import (
    PaymentCreateRequest, PaymentCreateResponse, PaymentVerifyRequest, PaymentVerifyResponse
)
from utils.supabase_client import supabase, get_user_id_from_auth
from utils.queue import get_queue
from services.notifications import send_order_confirmation_email, send_order_confirmation_whatsapp

logger = logging.getLogger(__name__)
router = APIRouter()

def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verifies Razorpay HMAC signature locally using the key secret."""
    secret_key = os.getenv("RAZORPAY_KEY_SECRET")
    if not secret_key or "mock" in secret_key:
        if signature == "mock_signature" or signature.startswith("mock_"):
            return True
            
    try:
        message = f"{order_id}|{payment_id}"
        secret_bytes = secret_key.encode()
        computed = hmac.new(secret_bytes, message.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, signature)
    except Exception as e:
        logger.error("Signature comparison errored out: %s", e)
        return False

@router.post("/create-order", response_model=PaymentCreateResponse)
def create_payment_order(req: PaymentCreateRequest):
    """
    Calls Razorpay or generates a mock order ID, and saves transaction status.
    """
    logger.info("Initializing payment order for MemoryLane order ID: %s", req.order_id)
    try:
        total_price = 49900  # Default ₹499 (Basic)
        try:
            order_res = supabase.table("orders").select("*").eq("id", req.order_id).execute()
            if order_res.data:
                total_price = order_res.data[0]["total_price"]
        except Exception as e:
            logger.error("Failed to query order total: %s", e)
            
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        
        rzp_order_id = None
        if key_id and "mock" not in key_id and key_secret and "mock" not in key_secret:
            try:
                import razorpay
                client = razorpay.Client(auth=(key_id, key_secret))
                client.set_app_details({"title": "MemoryLane Backend", "version": "1.0.0"})
                
                razorpay_order = client.order.create({
                    "amount": total_price,
                    "currency": "INR",
                    "receipt": req.order_id
                })
                rzp_order_id = razorpay_order.get("id")
                logger.info("Successfully created live Razorpay order: %s", rzp_order_id)
            except Exception as e:
                logger.error("Failed to create live Razorpay order: %s", e)
                if os.getenv("ENV") == "production":
                    return JSONResponse(
                        status_code=502,
                        content={"error": f"Razorpay payment gateway error: {str(e)}", "code": "PAYMENT_GATEWAY_ERROR", "status": 502}
                    )
                
        if not rzp_order_id:
            rzp_order_id = f"order_{uuid.uuid4().hex[:12]}"
            logger.info("Created mock Razorpay order ID: %s", rzp_order_id)
        
        try:
            supabase.table("payments").insert({
                "order_id": req.order_id,
                "razorpay_order_id": rzp_order_id,
                "amount": total_price,
                "status": "created"
            }).execute()
        except Exception as e:
            logger.error("Supabase payment log failed: %s", e)
            
        return PaymentCreateResponse(
            razorpay_order_id=rzp_order_id,
            amount=total_price
        )
    except Exception as e:
        logger.exception("Failed to create payment order")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to create payment order", "code": "PAYMENT_CREATE_ERROR", "status": 400}
        )

@router.post("/verify", response_model=PaymentVerifyResponse)
def verify_payment(req: PaymentVerifyRequest, background_tasks: BackgroundTasks):
    """
    Verifies signature and updates order + payments status on success.
    Triggers post-payment generation flow and worker queuing.
    """
    try:
        is_valid = verify_razorpay_signature(
            order_id=req.razorpay_order_id,
            payment_id=req.razorpay_payment_id,
            signature=req.razorpay_signature
        )
        
        if not is_valid:
            logger.warning("Razorpay Signature verification failed!")
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid payment signature verification failed", "code": "INVALID_SIGNATURE", "status": 400}
            )
            
        logger.info("Razorpay Payment verified successfully: %s", req.razorpay_payment_id)
        
        order_id = None
        event_name = "My Event"
        tier = "basic"
        recipient_phone = ""
        recipient_email = "customer@example.com"
        
        try:
            payment_res = supabase.table("payments").select("*").eq("razorpay_order_id", req.razorpay_order_id).execute()
            if payment_res.data:
                payment_rec = payment_res.data[0]
                order_id = payment_rec["order_id"]
                
                supabase.table("payments").update({
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_signature": req.razorpay_signature,
                    "status": "paid",
                    "paid_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }).eq("razorpay_order_id", req.razorpay_order_id).execute()
                
                order_res = supabase.table("orders").select("*").eq("id", order_id).execute()
                if order_res.data:
                    ord_data = order_res.data[0]
                    event_name = ord_data.get("event_name") or ord_data.get("book_title") or "My Event"
                    tier = ord_data.get("tier") or "basic"
                    recipient_phone = ord_data.get("shipping_phone") or ""
                    
                    user_res = supabase.table("profiles").select("*").eq("id", ord_data.get("user_id")).execute()
                    user_name = "Customer"
                    if user_res.data:
                        profile = user_res.data[0]
                        user_name = profile.get("name") or "Customer"
                        recipient_email = profile.get("email") or "customer@example.com"
                    
                    send_order_confirmation_email(
                        order_id=order_id,
                        recipient_email=recipient_email,
                        recipient_name=user_name,
                        event_name=event_name,
                        tier=tier
                    )
                    
                    if recipient_phone:
                        send_order_confirmation_whatsapp(
                            order_id=order_id,
                            recipient_phone=recipient_phone,
                            recipient_name=user_name,
                            event_name=event_name
                        )
                        
                    supabase.table("orders").update({
                        "status": "processing",
                        "processing_started_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }).eq("id", order_id).execute()
                    
                    batch_id = None
                    batch_res = supabase.table("photo_batches").select("id").eq("order_id", order_id).execute()
                    if batch_res.data:
                        batch_id = batch_res.data[0]["id"]
                        supabase.table("photo_batches").update({
                            "ai_status": "running",
                            "ai_progress": 0
                        }).eq("id", batch_id).execute()
                        
                    queue = get_queue("ai-pipeline")
                    job_data = {
                        "order_id": order_id,
                        "batch_id": batch_id or "mock_batch_id",
                        "tier": tier,
                        "book_title": event_name,
                        "caption_style": ord_data.get("caption_style") or "cinematic",
                        "language": ord_data.get("language") or "English"
                    }
                    
                    queue.add("generate-book", job_data)
                        
        except Exception as e:
            logger.error("Supabase database transactions failed: %s", e)
            if os.getenv("ENV") == "production":
                raise e
                
        estimated_minutes = 15 if tier == "photographer" else 60
        return PaymentVerifyResponse(
            success=True,
            order_id=order_id,
            message="Payment confirmed. We'll notify you when your gallery is ready to review.",
            estimated_minutes=estimated_minutes
        )
    except Exception as e:
        logger.exception("Failed to verify payment")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to verify transaction", "code": "PAYMENT_VERIFY_ERROR", "status": 400}
        )

@router.post("/free-checkout", response_model=PaymentVerifyResponse)
def free_checkout(req: PaymentCreateRequest, background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """
    Handles zero-price checkout. Directly marks order paid and triggers AI queue.
    """
    user_id = get_user_id_from_auth(authorization)
    
    try:
        order_res = supabase.table("orders").select("*").eq("id", req.order_id).execute()
        if not order_res.data:
            raise HTTPException(status_code=404, detail="Order not found")
            
        ord_data = order_res.data[0]
        if ord_data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this order")
            
        if ord_data["tier"].lower() != "free":
            raise HTTPException(status_code=400, detail="Only free tier orders can use free-checkout")
            
        supabase.table("payments").insert({
            "order_id": req.order_id,
            "razorpay_order_id": f"free_{uuid.uuid4().hex[:12]}",
            "amount": 0,
            "status": "paid",
            "paid_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).execute()
        
        event_name = ord_data.get("event_name") or ord_data.get("book_title") or "My Event"
        tier = ord_data.get("tier") or "free"
        recipient_phone = ord_data.get("shipping_phone") or ""
        
        user_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        user_name = "Customer"
        recipient_email = "customer@example.com"
        if user_res.data:
            profile = user_res.data[0]
            user_name = profile.get("name") or "Customer"
            recipient_email = profile.get("email") or "customer@example.com"
            
        send_order_confirmation_email(
            order_id=req.order_id,
            recipient_email=recipient_email,
            recipient_name=user_name,
            event_name=event_name,
            tier=tier
        )
        if recipient_phone:
            send_order_confirmation_whatsapp(
                order_id=req.order_id,
                recipient_phone=recipient_phone,
                recipient_name=user_name,
                event_name=event_name
            )
            
        supabase.table("orders").update({
            "status": "processing",
            "processing_started_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("id", req.order_id).execute()
        
        batch_id = None
        batch_res = supabase.table("photo_batches").select("id").eq("order_id", req.order_id).execute()
        if batch_res.data:
            batch_id = batch_res.data[0]["id"]
            supabase.table("photo_batches").update({
                "ai_status": "running",
                "ai_progress": 0
            }).eq("id", batch_id).execute()
            
        queue = get_queue("ai-pipeline")
        job_data = {
            "order_id": req.order_id,
            "batch_id": batch_id or "mock_batch_id",
            "tier": tier,
            "book_title": event_name,
            "caption_style": ord_data.get("caption_style") or "cinematic",
            "language": ord_data.get("language") or "English"
        }
        
        queue.add("generate-book", job_data)
            
        return PaymentVerifyResponse(
            success=True,
            order_id=req.order_id,
            message="Free gallery confirmed. We'll notify you when your gallery is ready to review.",
            estimated_minutes=60
        )
    except Exception as e:
        logger.exception("Failed to verify free checkout order")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to check out free order", "code": "FREE_CHECKOUT_ERROR", "status": 400}
        )
