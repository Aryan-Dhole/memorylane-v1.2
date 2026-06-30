import os
import logging
import razorpay
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

async def issue_full_refund(order_id: str) -> bool:
    """
    Fetches the paid transaction for the order, executes the Razorpay API refund call,
    and updates database payment and order status records to 'refunded'.
    """
    logger.info("Initializing refund flow for order ID: %s", order_id)
    
    try:
        # 1. Query matching paid payment record
        pay_res = supabase.table("payments") \
            .select("*") \
            .eq("order_id", order_id) \
            .eq("status", "paid") \
            .execute()
            
        if not pay_res.data:
            logger.warning("No paid payment record found for order %s. Bypassing Razorpay refund API call.", order_id)
            # Update order status to refunded in case status was paid but log was missing
            try:
                supabase.table("orders").update({"status": "refunded"}).eq("id", order_id).execute()
            except Exception as e:
                logger.error("DB error updating order to refunded: %s", e)
            return True
            
        payment_rec = pay_res.data[0]
        razorpay_payment_id = payment_rec.get("razorpay_payment_id")
        amount_paise = payment_rec.get("amount")
        
        # 2. Check for mock payment identifiers
        if not razorpay_payment_id or "mock" in razorpay_payment_id:
            logger.info("Mock payment ID detected (%s). Simulating successful DB refund updates.", razorpay_payment_id)
            try:
                supabase.table("payments").update({"status": "refunded"}).eq("order_id", order_id).execute()
                supabase.table("orders").update({"status": "refunded"}).eq("id", order_id).execute()
                return True
            except Exception as db_err:
                logger.error("DB error during mock refund updates: %s", db_err)
                return False
                
        # 3. Call Razorpay API
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        
        if not key_id or not key_secret:
            logger.error("Razorpay keys not configured. Cannot process refund.")
            return False
            
        client = razorpay.Client(auth=(key_id, key_secret))
        refund = client.payment.refund(razorpay_payment_id, {
            "amount": amount_paise,
            "speed": "optimum",  # optimum triggers instant refund where supported
            "notes": {"order_id": order_id, "reason": "AI processing failed"}
        })
        
        refund_id = refund.get("id")
        logger.info("Successfully executed Razorpay refund API call. Refund ID: %s", refund_id)
        
        # 4. Save status updates in Supabase
        try:
            supabase.table("payments").update({"status": "refunded"}).eq("order_id", order_id).execute()
            supabase.table("orders").update({"status": "refunded"}).eq("id", order_id).execute()
            logger.info("Database records for order %s updated to refunded successfully.", order_id)
            return True
        except Exception as db_err:
            logger.error("DB error updating transaction records to refunded: %s", db_err)
            return False
            
    except Exception as e:
        logger.error("Failed to issue refund for order %s: %s", order_id, e, exc_info=True)
        return False
