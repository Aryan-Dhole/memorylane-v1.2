import os
import logging
import json

logger = logging.getLogger(__name__)

# Try loading Resend & Twilio
try:
    import resend
    HAS_RESEND = True
except ImportError:
    HAS_RESEND = False

try:
    from twilio.rest import Client as TwilioClient
    HAS_TWILIO = True
except ImportError:
    HAS_TWILIO = False


def _get_twilio_client():
    if not HAS_TWILIO:
        return None, None
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    if not sid or "mock" in sid or not token or "mock" in token:
        return None, None
    try:
        return TwilioClient(sid, token), from_number
    except Exception as e:
        logger.error("Failed to initialize Twilio client: %s", e)
        return None, None


# ---------------- EMAIL 1: PAYMENT CONFIRMED ----------------
def send_order_confirmation_email(
    order_id: str,
    recipient_email: str,
    recipient_name: str,
    event_name: str,
    tier: str
) -> bool:
    """
    Sends premium payment confirmation email notifying the user of gallery creation startup.
    """
    api_key = os.getenv("RESEND_API_KEY")
    is_photographer = tier.lower() == "photographer"
    est_time = "15 minutes" if is_photographer else "60 minutes"
    
    html_content = f"""
    <div style="background-color: #0a0a0f; color: #faf9f7; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 8px; max-width: 600px; margin: auto;">
        <div style="border-bottom: 1px solid #222227; padding-bottom: 20px; text-align: center;">
            <h1 style="color: #c9a96e; font-family: 'Playfair Display', serif; font-size: 28px; margin: 0;">MemoryLane</h1>
        </div>
        <div style="padding: 30px 0;">
            <h2 style="font-size: 20px; font-weight: normal; margin-top: 0;">We're creating your {event_name} gallery ✨</h2>
            <p>Hi {recipient_name},</p>
            <p>We received your payment! Our AI is working its magic: sorting through photos, removing duplicates, clustering faces, and writing contextual captions.</p>
            <div style="background-color: #121217; border-left: 3px solid #c9a96e; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #a89f94; letter-spacing: 1px;">Gallery Details</p>
                <p style="margin: 0; font-size: 18px; color: #faf9f7; font-family: 'Playfair Display', serif;"><strong>{event_name}</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #a89f94;">Tier: {tier.upper()}</p>
            </div>
            <p style="font-size: 15px; color: #a89f94;">Estimated generation time: <strong>~{est_time}</strong></p>
            <p>We will email and WhatsApp you the moment your live gallery link is ready. No further action is required.</p>
        </div>
        <div style="border-top: 1px solid #222227; padding-top: 20px; font-size: 11px; text-align: center; color: #a89f94;">
            MemoryLane AI • memorylane.in
        </div>
    </div>
    """
    
    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [EMAIL DRY RUN] To: %s, Subject: Payment Confirmed, Title: %s", recipient_email, event_name)
        return True
        
    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane <onboarding@resend.dev>",
            "to": recipient_email,
            "subject": f"We're creating your {event_name} gallery ✨",
            "html": html_content
        })
        logger.info("Email confirmation sent successfully via Resend to %s", recipient_email)
        return True
    except Exception as e:
        logger.error("Failed to send email via Resend: %s", e)
        return False


def send_order_confirmation_whatsapp(order_id: str, recipient_phone: str, recipient_name: str, event_name: str) -> bool:
    """
    Sends WhatsApp notification using Twilio WhatsApp sandbox.
    """
    client, from_number = _get_twilio_client()
    body = f"Hi {recipient_name}! We're building your {event_name} gallery. Ready in ~15 minutes ✨ Order ID: #{order_id}"
    
    if not client:
        logger.info("Twilio not configured. [WHATSAPP DRY RUN] To: %s, Message: %s", recipient_phone, body)
        return True
        
    try:
        client.messages.create(
            from_=from_number,
            body=body,
            to=f"whatsapp:{recipient_phone}"
        )
        logger.info("WhatsApp confirmation sent successfully to %s", recipient_phone)
        return True
    except Exception as e:
        logger.warning("Swallowing Twilio exception (Sandbox limit or verification missing): %s", e)
        return True


# ---------------- EMAIL 2: GALLERY READY ----------------
def send_gallery_ready_email(
    order_id: str,
    recipient_email: str,
    recipient_name: str,
    event_name: str,
    share_url: str,
    stats_text: str = ""
) -> bool:
    """
    Sends email notifying the user that their event gallery is live.
    """
    api_key = os.getenv("RESEND_API_KEY")
        
    html_content = f"""
    <div style="background-color: #0a0a0f; color: #faf9f7; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 8px; max-width: 600px; margin: auto;">
        <div style="border-bottom: 1px solid #222227; padding-bottom: 20px; text-align: center;">
            <h1 style="color: #c9a96e; font-family: 'Playfair Display', serif; font-size: 28px; margin: 0;">MemoryLane</h1>
        </div>
        <div style="padding: 30px 0;">
            <h2 style="font-size: 20px; font-weight: normal; margin-top: 0; text-align: center;">Your gallery is live! 🎉</h2>
            <p>Hi {recipient_name},</p>
            <p>The AI process has completed successfully. Your private event gallery for <strong>{event_name}</strong> is live and ready to share.</p>
            
            {stats_text}
            
            <div style="margin: 30px 0; text-align: center;">
                <a href="{share_url}" style="display: inline-block; background-color: #c9a96e; color: #0a0a0f; padding: 16px 30px; border-radius: 30px; font-weight: bold; text-decoration: none; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase;">
                    Open Your Event Gallery
                </a>
            </div>
            
            <div style="background-color: #121217; padding: 15px; border-radius: 8px; margin-top: 25px;">
                <p style="margin: 0; font-size: 13px; color: #a89f94; text-align: center; line-height: 1.5;">
                    <strong>Share with Family:</strong> Send your gallery link to your WhatsApp groups. Guests can view the scrollable moments, filter by their own faces, react with emojis, and upload their own photos.
                </p>
            </div>
        </div>
        <div style="border-top: 1px solid #222227; padding-top: 20px; font-size: 11px; text-align: center; color: #a89f94;">
            MemoryLane AI • memorylane.in
        </div>
    </div>
    """
    
    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [EMAIL DRY RUN] To: %s, Subject: Gallery Ready, Title: %s", recipient_email, event_name)
        return True
        
    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane <onboarding@resend.dev>",
            "to": recipient_email,
            "subject": f"{event_name} gallery is live — share it now",
            "html": html_content
        })
        logger.info("Email gallery ready notification sent successfully to %s", recipient_email)
        return True
    except Exception as e:
        logger.error("Failed to send email via Resend: %s", e)
        return False


def send_gallery_ready_whatsapp(recipient_phone: str, event_name: str, share_url: str) -> bool:
    """
    Sends WhatsApp notification when the gallery finishes successfully.
    """
    client, from_number = _get_twilio_client()
    body = f"Your {event_name} gallery is ready! 🎉 Share this link with everyone who was there so they can find their photos and upload theirs: {share_url}"
    
    if not client:
        logger.info("Twilio not configured. [WHATSAPP DRY RUN] To: %s, Message: %s", recipient_phone, body)
        return True
        
    try:
        client.messages.create(
            from_=from_number,
            body=body,
            to=f"whatsapp:{recipient_phone}"
        )
        logger.info("WhatsApp ready notification sent successfully to %s", recipient_phone)
        return True
    except Exception as e:
        logger.warning("Swallowing Twilio exception (Sandbox limit or verification missing): %s", e)
        return True


# ---------------- EMAIL 3: PIPELINE FAILED & REFUND ----------------
def send_user_pipeline_failed_email(recipient_email: str, recipient_name: str, amount_paid: float) -> bool:
    """
    Sends email alert to the user if the AI pipeline crashes, apologizing and confirming a refund.
    """
    api_key = os.getenv("RESEND_API_KEY")
    html_content = f"""
    <div style="background-color: #faf9f7; color: #0a0a0f; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 8px; max-width: 600px; margin: auto; border: 1px solid #e8e4dc;">
        <div style="border-bottom: 1px solid #e8e4dc; padding-bottom: 20px; text-align: center;">
            <h1 style="color: #0a0a0f; font-family: 'Playfair Display', serif; font-size: 28px; margin: 0;">MemoryLane</h1>
        </div>
        <div style="padding: 30px 0; line-height: 1.6;">
            <h2 style="font-size: 20px; font-weight: normal; margin-top: 0; color: #b22222;">Something went wrong — refund issued</h2>
            <p>Hi {recipient_name},</p>
            <p>We are very sorry. Our AI pipeline encountered a critical error while compiling your photos and could not resolve the layouts.</p>
            <p>As a result, <strong>we have issued a full refund of ₹{amount_paid:.2f} to your original payment method</strong>. You should see it reflect on your account statements within 3–5 business days.</p>
            <p>If you'd like to try again with a different batch of photos, please visit your dashboard. Please contact us at support@memorylane.in if you have any questions.</p>
            <p>Sincere apologies for the trouble,</p>
            <p>The MemoryLane Team</p>
        </div>
    </div>
    """
    
    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [EMAIL DRY RUN] To: %s, Subject: Refund Issued, Amount: %s", recipient_email, amount_paid)
        return True
        
    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane Support <onboarding@resend.dev>",
            "to": recipient_email,
            "subject": "Something went wrong — refund issued",
            "html": html_content
        })
        logger.info("User pipeline failure email sent successfully to %s.", recipient_email)
        return True
    except Exception as e:
        logger.error("Failed to send user pipeline failure email: %s", e)
        return False


def send_pipeline_failed_whatsapp(recipient_phone: str, recipient_name: str) -> bool:
    """
    Sends WhatsApp notification for failed AI processing.
    """
    client, from_number = _get_twilio_client()
    body = f"Hi {recipient_name}, something went wrong processing your photos. We've refunded your payment automatically. Sorry for the trouble — please try again."
    
    if not client:
        logger.info("Twilio not configured. [WHATSAPP DRY RUN] To: %s, Message: %s", recipient_phone, body)
        return True
        
    try:
        client.messages.create(
            from_=from_number,
            body=body,
            to=f"whatsapp:{recipient_phone}"
        )
        logger.info("WhatsApp failure alert sent successfully to %s", recipient_phone)
        return True
    except Exception as e:
        logger.warning("Swallowing Twilio exception (Sandbox limit or verification missing): %s", e)
        return True


# ---------------- EMAIL 4: ADMIN ERROR ALERT ----------------
def send_admin_failed_job_alert(failed_job_data: dict) -> bool:
    """
    Sends email alert to the administrator when a background job fails permanently.
    """
    api_key = os.getenv("RESEND_API_KEY")
    html_content = f"""
    <h1>MemoryLane Alert: Background Job Failed</h1>
    <p>A background AI pipeline job exceeded the maximum limit of 3 retries and has been moved to the dead letter queue (failed-jobs).</p>
    <pre>{json.dumps(failed_job_data, indent=2)}</pre>
    """
    
    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [ADMIN EMAIL DRY RUN] Body: %s", html_content)
        return True
        
    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane Admin <onboarding@resend.dev>",
            "to": os.getenv("ADMIN_EMAIL", "admin@memorylane.in"),
            "subject": "CRITICAL: Background Job Failed Max Retries",
            "html": html_content
        })
        logger.info("Admin failed-job email alert sent successfully.")
        return True
    except Exception as e:
        logger.error("Failed to send admin failed job alert via Resend: %s", e)
        return False


# ---------------- EMAIL 5: REVIEW READY ----------------
def send_review_ready_email(
    order_id: str,
    recipient_email: str,
    recipient_name: str,
    event_name: str,
    review_url: str,
    stats_text: str = "",
    review_deadline: str = ""
) -> bool:
    """
    Sends email notifying the user that their gallery is ready to review before going live.
    """
    api_key = os.getenv("RESEND_API_KEY")

    html_content = f"""
    <div style="background-color: #0a0a0f; color: #faf9f7; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 8px; max-width: 600px; margin: auto;">
        <div style="border-bottom: 1px solid #222227; padding-bottom: 20px; text-align: center;">
            <h1 style="color: #c9a96e; font-family: 'Playfair Display', serif; font-size: 28px; margin: 0;">MemoryLane</h1>
        </div>
        <div style="padding: 30px 0;">
            <h2 style="font-size: 22px; font-weight: normal; margin-top: 0; text-align: center;">Your gallery is ready to review! 🎉</h2>
            <p>Hi {recipient_name},</p>
            <p>Your <strong>{event_name}</strong> gallery is ready. Our AI has curated the best moments from your photos.</p>

            {stats_text}

            <p style="font-size: 14px; color: #a89f94; margin-top: 20px;">Before your gallery goes live, take a look and make any final changes — remove a photo, edit a caption, or just hit publish if it looks perfect.</p>

            <div style="margin: 30px 0; text-align: center;">
                <a href="{review_url}" style="display: inline-block; background-color: #c9a96e; color: #0a0a0f; padding: 16px 30px; border-radius: 30px; font-weight: bold; text-decoration: none; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase;">
                    Review Your Gallery
                </a>
            </div>

            <div style="background-color: #121217; padding: 15px; border-radius: 8px; margin-top: 25px; border-left: 3px solid #c9a96e;">
                <p style="margin: 0; font-size: 13px; color: #a89f94; line-height: 1.5;">
                    <strong>⏰ Auto-publishes in 24 hours</strong> if no action is taken.
                    {f'Deadline: {review_deadline}' if review_deadline else ''}
                </p>
            </div>

            <div style="background-color: #121217; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; font-size: 13px; color: #a89f94; text-align: center; line-height: 1.5;">
                    <strong>What you can do in the review:</strong><br/>
                    ✓ Remove any photos you don't want<br/>
                    ✓ Edit captions<br/>
                    ✓ Add more photos from your uploaded batch<br/>
                    ✓ Rearrange photos within moments
                </p>
            </div>
        </div>
        <div style="border-top: 1px solid #222227; padding-top: 20px; font-size: 11px; text-align: center; color: #a89f94;">
            MemoryLane AI • memorylane.in
        </div>
    </div>
    """

    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [EMAIL DRY RUN] To: %s, Subject: Review Ready, Title: %s", recipient_email, event_name)
        return True

    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane <onboarding@resend.dev>",
            "to": recipient_email,
            "subject": f"🎉 Your {event_name} gallery is ready to review",
            "html": html_content
        })
        logger.info("Review ready email sent successfully to %s", recipient_email)
        return True
    except Exception as e:
        logger.error("Failed to send review ready email via Resend: %s", e)
        return False


def send_review_ready_whatsapp(recipient_phone: str, recipient_name: str, event_name: str, review_url: str) -> bool:
    """
    Sends WhatsApp notification when the gallery is ready for user review.
    """
    client, from_number = _get_twilio_client()
    body = f"Your {event_name} gallery is ready! 🎉 Review it here before it goes live: {review_url}\n\nYou have 24 hours to make changes, then it publishes automatically."

    if not client:
        logger.info("Twilio not configured. [WHATSAPP DRY RUN] To: %s, Message: %s", recipient_phone, body)
        return True

    try:
        client.messages.create(
            from_=from_number,
            body=body,
            to=f"whatsapp:{recipient_phone}"
        )
        logger.info("WhatsApp review ready notification sent successfully to %s", recipient_phone)
        return True
    except Exception as e:
        logger.warning("Swallowing Twilio exception (Sandbox limit or verification missing): %s", e)
        return True


# ---------------- EMAIL 6: GALLERY AUTO-PUBLISHED ----------------
def send_gallery_auto_published_email(
    order_id: str,
    recipient_email: str,
    recipient_name: str,
    event_name: str,
    share_url: str
) -> bool:
    """
    Sends email notifying the user that their gallery was auto-published after the review deadline passed.
    """
    api_key = os.getenv("RESEND_API_KEY")

    html_content = f"""
    <div style="background-color: #0a0a0f; color: #faf9f7; font-family: 'Inter', sans-serif; padding: 40px; border-radius: 8px; max-width: 600px; margin: auto;">
        <div style="border-bottom: 1px solid #222227; padding-bottom: 20px; text-align: center;">
            <h1 style="color: #c9a96e; font-family: 'Playfair Display', serif; font-size: 28px; margin: 0;">MemoryLane</h1>
        </div>
        <div style="padding: 30px 0;">
            <h2 style="font-size: 22px; font-weight: normal; margin-top: 0; text-align: center;">Your gallery is now live! 🎉</h2>
            <p>Hi {recipient_name},</p>
            <p>Your <strong>{event_name}</strong> gallery was published automatically. It's ready to share with everyone who was there.</p>

            <div style="margin: 30px 0; text-align: center;">
                <a href="{share_url}" style="display: inline-block; background-color: #c9a96e; color: #0a0a0f; padding: 16px 30px; border-radius: 30px; font-weight: bold; text-decoration: none; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase;">
                    View Your Gallery
                </a>
            </div>

            <div style="background-color: #121217; padding: 15px; border-radius: 8px; margin-top: 25px;">
                <p style="margin: 0; font-size: 13px; color: #a89f94; text-align: center; line-height: 1.5;">
                    To make changes, you can still edit captions and remove photos from your <a href="https://memorylane.in/dashboard" style="color: #c9a96e; text-decoration: underline;">dashboard</a>.
                </p>
            </div>
        </div>
        <div style="border-top: 1px solid #222227; padding-top: 20px; font-size: 11px; text-align: center; color: #a89f94;">
            MemoryLane AI • memorylane.in
        </div>
    </div>
    """

    if not api_key or "mock" in api_key or not HAS_RESEND:
        logger.info("Resend not configured. [EMAIL DRY RUN] To: %s, Subject: Gallery Auto-Published, Title: %s", recipient_email, event_name)
        return True

    try:
        resend.api_key = api_key
        resend.Emails.send({
            "from": "MemoryLane <onboarding@resend.dev>",
            "to": recipient_email,
            "subject": f"Your {event_name} gallery is now live 🎉",
            "html": html_content
        })
        logger.info("Gallery auto-published email sent successfully to %s", recipient_email)
        return True
    except Exception as e:
        logger.error("Failed to send auto-published email via Resend: %s", e)
        return False


def send_gallery_auto_published_whatsapp(recipient_phone: str, event_name: str, share_url: str) -> bool:
    """
    Sends WhatsApp notification when the gallery is auto-published after review deadline.
    """
    client, from_number = _get_twilio_client()
    body = f"Your {event_name} gallery is now live! 🎉 Share it with everyone: {share_url}"

    if not client:
        logger.info("Twilio not configured. [WHATSAPP DRY RUN] To: %s, Message: %s", recipient_phone, body)
        return True

    try:
        client.messages.create(
            from_=from_number,
            body=body,
            to=f"whatsapp:{recipient_phone}"
        )
        logger.info("WhatsApp auto-published notification sent successfully to %s", recipient_phone)
        return True
    except Exception as e:
        logger.warning("Swallowing Twilio exception (Sandbox limit or verification missing): %s", e)
        return True
