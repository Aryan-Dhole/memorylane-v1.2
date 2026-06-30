from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class UploadInitRequest(BaseModel):
    order_id: str
    file_count: int
    event_type: str

class UploadUrlItem(BaseModel):
    filename: str
    url: str
    s3_key: str

class UploadInitResponse(BaseModel):
    batch_id: str
    upload_urls: List[UploadUrlItem]

class UploadConfirmRequest(BaseModel):
    batch_id: str
    uploaded_keys: List[str]

class UploadConfirmResponse(BaseModel):
    success: bool
    total_confirmed: int

class AnalyzeRequest(BaseModel):
    book_size: str  # "small", "medium", "large", "xl"
    caption_style: str = "poetic"  # "poetic", "factual", "playful", "minimal"
    language: str = "English"

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str

class AnalyzeStatusResponse(BaseModel):
    status: str
    progress: int
    eta_seconds: int

class SelectedPhotoMetadata(BaseModel):
    path: str
    caption: str
    chapter: int
    scene: str
    dominant_emotion: Optional[str] = "candid_unaware"

class ChapterMetadata(BaseModel):
    title: str
    start_index: int

class AnalyzeResultResponse(BaseModel):
    selected_photos: List[SelectedPhotoMetadata]
    total_input: int
    total_selected: int
    chapters: List[ChapterMetadata]
    processing_time_seconds: float

class PaymentCreateRequest(BaseModel):
    order_id: str

class PaymentCreateResponse(BaseModel):
    razorpay_order_id: str
    amount: int
    currency: str = "INR"

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class PaymentVerifyResponse(BaseModel):
    success: bool

class OrderCreateRequest(BaseModel):
    tier: str
    book_title: Optional[str] = "My Memory Book"
    event_type: Optional[str] = "classic"
    book_type: Optional[str] = "classic"
    caption_style: str = "poetic"
    language: str = "English"
    page_count: Optional[int] = None
    total_price: Optional[int] = None
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    event_location: Optional[str] = None

class OrderUpdateStatusRequest(BaseModel):
    status: str

class OrderShippingUpdateRequest(BaseModel):
    shipping_name: str
    shipping_address: str
    shipping_city: str
    shipping_pincode: str
    shipping_phone: str
