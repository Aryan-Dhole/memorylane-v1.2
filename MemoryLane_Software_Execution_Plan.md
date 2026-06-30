# MemoryLane — Full Software Execution Plan
## For Agentic Coding Reference (Claude Code / Antigravity)

This document is the complete, task-level software build plan for MemoryLane, an AI-powered premium photo book platform for India. It is written to be used directly as context for an agentic coding session. Every section describes exactly what to build, what libraries to use, what the file should be named, what the function should do, and what the expected output is. No phase labels — just the full sequential build order from zero to launch.

---

## PART 1 — DEVELOPMENT ENVIRONMENT SETUP

### 1.1 Machine Setup

Install the following tools before writing any code:

- VS Code with extensions: Python (Microsoft), Pylance, ESLint, Prettier, Tailwind CSS IntelliSense, GitLens
- Anaconda or Miniconda for Python environment management
- Node.js 20 LTS (download from nodejs.org) and pnpm (`npm install -g pnpm`)
- Git (configure with your name and email)

Create two GitHub repositories:
- `memorylane-backend` — private, Python/FastAPI
- `memorylane-frontend` — private, Next.js

Clone both locally. In each repo, create a `.gitignore` (use GitHub's Python and Node templates). Never commit `.env` files.

### 1.2 Python Environment

```
conda create -n memorylane python=3.11
conda activate memorylane
```

Install all Python dependencies at once:

```
pip install fastapi uvicorn[standard] opencv-python pillow deepface insightface boto3 \
            tensorflow imagehash scikit-image python-multipart piexif \
            open-clip-torch anthropic redis bullmq python-dotenv httpx pytest
```

Create `requirements.txt` by running `pip freeze > requirements.txt` after installation.

### 1.3 Cloud Accounts to Create (Do This Day 1)

Create accounts on all of the following before writing backend code, because you will need their API keys in your `.env` file:

**AWS** — go to aws.amazon.com, create a free account. In the AWS console, create an IAM user (not root), give it S3FullAccess and optionally RekognitionFullAccess. Generate access key and secret key. Note these — you will never see the secret again.

**Supabase** — go to supabase.com, create a new project. Note the Project URL, anon public key, and service role key. The service role key bypasses Row Level Security — only use it on the server, never in the browser.

**Razorpay** — go to razorpay.com, create an account, complete KYC. In the dashboard, go to Settings > API Keys and generate a test key pair (Key ID and Key Secret). You will switch to live keys after going live.

**Resend** — go to resend.com, create a free account. Generate an API key. Free tier allows 100 emails per day, which is enough for the first 3 months.

**Twilio** — go to twilio.com, create an account. Get your Account SID and Auth Token. Join the WhatsApp Sandbox (in the Messaging > Try it Out > Send a WhatsApp Message section). Note the sandbox number.

**Anthropic (Claude API)** — go to console.anthropic.com, create an account, add a payment method. Generate an API key. You will use this for caption generation at approximately ₹0.80 per book.

**Railway** — go to railway.app, create an account. This is where the FastAPI backend and Redis instance will be deployed. Free tier gives $5/month credit.

**Vercel** — go to vercel.com, connect your GitHub account. The Next.js frontend deploys here for free.

### 1.4 Environment Variables

In the root of `memorylane-backend`, create a file called `.env`:

```
# AWS
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_REGION=ap-south-1
S3_BUCKET_NAME=memorylane-photos

# Supabase
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_secret

# Twilio / WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Resend
RESEND_API_KEY=re_...

# Redis (fill after Railway deployment)
REDIS_URL=redis://localhost:6379

# App
ENV=development
FRONTEND_URL=http://localhost:3000
```

In `memorylane-frontend`, create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## PART 2 — BACKEND PROJECT STRUCTURE

### 2.1 Folder Layout

Inside `memorylane-backend`, create the following folder structure:

```
memorylane-backend/
├── main.py                  # FastAPI app entry point
├── .env
├── requirements.txt
├── services/
│   ├── __init__.py
│   ├── quality_scorer.py    # Blur, exposure, resolution scoring
│   ├── face_detector.py     # InsightFace face detection + emotion
│   ├── duplicate_remover.py # pHash + SSIM deduplication
│   ├── aesthetic_scorer.py  # NIMA scoring
│   ├── story_sequencer.py   # EXIF ordering + narrative arc
│   ├── caption_generator.py # Claude API caption generation
│   ├── photo_selector.py    # Final ranked selection engine
│   └── s3_service.py        # AWS S3 upload/download helpers
├── routes/
│   ├── __init__.py
│   ├── upload.py            # POST /upload
│   ├── analyze.py           # POST /analyze, GET /status
│   ├── books.py             # POST /generate-book
│   ├── orders.py            # Order management
│   └── payments.py          # Razorpay integration
├── models/
│   ├── __init__.py
│   └── schemas.py           # Pydantic request/response models
├── utils/
│   ├── __init__.py
│   ├── supabase_client.py   # Supabase connection
│   └── queue.py             # BullMQ / Redis job queue
└── tests/
    ├── test_quality.py
    ├── test_faces.py
    └── test_pipeline.py
```

### 2.2 main.py

Create `main.py` as the FastAPI entry point:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, analyze, books, orders, payments
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MemoryLane API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "memorylane-api"}
```

Run locally with: `uvicorn main:app --reload --port 8000`

---

## PART 3 — AI PIPELINE SERVICES

Build each service as a standalone Python file in the `services/` folder. Each file should be independently testable — write a small `if __name__ == "__main__":` block at the bottom of each that runs the service on a test image so you can validate it without running the full API.

### 3.1 services/quality_scorer.py

This service takes a path to an image file and returns a quality score from 0 to 100. It checks three things: blur level, exposure quality, and minimum resolution.

**Blur detection** uses the Laplacian operator from OpenCV. Load the image in grayscale, apply `cv2.Laplacian()`, then compute the variance of the result. A variance below 100 means the image is blurry. A variance above 500 means it is sharp. Scale linearly between those bounds for a 0–100 blur score.

**Exposure detection** uses histogram analysis. Load the image, convert to grayscale, compute `cv2.calcHist()` on the full 256-value range. If more than 10% of pixels are below value 20 (very dark), mark it as underexposed. If more than 10% of pixels are above 235 (very bright), mark it as overexposed. Both conditions reduce the exposure score.

**Resolution check** uses Pillow. Open the image, read `.size` which returns (width, height). Standard books require minimum 1200x800 pixels. Premium books require 2400x1600. Return a boolean flag for each tier.

**Final score**: blur_score * 0.5 + exposure_score * 0.3 + resolution_score * 0.2, normalized to 0–100.

The function signature should be:
```python
def score_image_quality(image_path: str) -> dict:
    # Returns: {"blur_score": float, "exposure_score": float,
    #           "resolution_ok_standard": bool, "resolution_ok_premium": bool,
    #           "final_quality_score": float, "reject": bool}
```

Mark `reject: True` if final_quality_score is below 30, or if the image is below minimum standard resolution.

### 3.2 services/face_detector.py

This service detects faces in a photo, clusters faces by identity across a batch, detects emotions, and flags photos where a face has closed eyes.

**Face detection** uses InsightFace. Import `insightface` and initialize the `FaceAnalysis` model with `app = FaceAnalysis(name='buffalo_l')`. Call `app.prepare(ctx_id=0, det_size=(640, 640))` — use `ctx_id=-1` for CPU-only. Call `app.get(image)` where image is a numpy array from `cv2.imread()`. This returns a list of Face objects, each with `.bbox`, `.embedding` (512-dimensional), `.age`, `.gender`.

**Emotion detection** uses DeepFace. Import `deepface.DeepFace`. Call `DeepFace.analyze(img_path, actions=['emotion'], enforce_detection=False)`. This returns a list of results, one per detected face, each with a `dominant_emotion` field (happy, sad, angry, surprise, neutral, fear, disgust).

**Eyes-closed detection**: DeepFace returns facial action units when `actions=['emotion', 'action']`. The AU45 unit corresponds to eye blink. Alternatively, detect eye landmarks from InsightFace keypoints (the 5-point landmarks include both eye corners) and measure the eye aspect ratio (EAR). If EAR < 0.2 for either eye, the eye is likely closed.

**Face identity clustering** across a batch of photos: collect all face embeddings from all images. Use cosine similarity to group embeddings — two faces are the same person if cosine similarity > 0.6. Assign a cluster ID to each face. This tells you which photos contain the bride, which contain the groom, etc. Use this in the selection step to ensure key people appear in the final book.

**Face scoring for an image**: an image scores higher if it has (a) detected faces, (b) faces showing happy or surprise emotion, (c) eyes are open on all faces, (d) no faces are blurry (check blur score on face crop separately).

The function signatures:
```python
def detect_faces(image_path: str) -> dict:
    # Returns: {"face_count": int, "faces": [...], "has_eyes_closed": bool,
    #           "dominant_emotion": str, "face_score": float}

def cluster_faces_in_batch(image_paths: list) -> dict:
    # Returns: {"clusters": {cluster_id: [image_paths]}, "key_faces": [cluster_ids]}
```

### 3.3 services/duplicate_remover.py

This service removes duplicate and near-duplicate photos from a batch, keeping the best version from each burst.

**Perceptual hashing (pHash)**: import `imagehash` and `PIL.Image`. For each image, compute `imagehash.phash(Image.open(path))`. Two images with Hamming distance ≤ 8 between their pHashes are considered near-duplicates. Group all images by similarity — this is a graph problem where images are nodes and edges exist between images with distance ≤ 8.

**SSIM confirmation**: for pairs that are close but not identical in pHash (distance 5–10), confirm with Structural Similarity Index. Import `skimage.metrics.structural_similarity`. Convert both images to grayscale numpy arrays resized to 256x256. Call `structural_similarity(img1, img2)`. Score above 0.85 means they are duplicates.

**Scene clustering by time**: parse EXIF timestamp from each image using Pillow's `._getexif()` method or `piexif.load()`. The key for DateTimeOriginal is tag 36867. Parse to a datetime object. Group photos taken within a 5-minute window as belonging to the same "moment cluster". Within each cluster, keep only the image with the highest quality_score from Part 3.1.

**Best-of-burst selection**: within each duplicate group, rank all images by the combined quality + face score, and keep only rank 1.

```python
def remove_duplicates(image_paths: list, quality_scores: dict) -> list:
    # Returns: list of image_paths with duplicates removed, best image per group kept

def cluster_by_time(image_paths: list, window_minutes: int = 5) -> dict:
    # Returns: {"clusters": {cluster_id: [image_paths]}, "cluster_timestamps": {}}
```

### 3.4 services/aesthetic_scorer.py

This service uses the NIMA (Neural Image Assessment) model to score the aesthetic quality of photos.

**Model setup**: NIMA uses a MobileNet backbone trained on the AVA (Aesthetic Visual Analysis) dataset. The model predicts a distribution over scores 1–10, and the mean of this distribution is the aesthetic score.

Download the pretrained weights. The simplest approach for beginners is to use the `image-quality` pip package (`pip install image-quality`) which wraps NIMA with pretrained weights and provides a simple API. Alternatively, search for "NIMA TensorFlow Keras" on GitHub — the most starred implementation by idealo has pretrained weights available for download.

```python
from imquality import brisque  # Alternative: BRISQUE metric, no GPU needed
import cv2

def score_aesthetic(image_path: str) -> float:
    # Returns: aesthetic score 0.0–10.0
    # Higher is more aesthetically pleasing
```

If GPU is not available during development, use BRISQUE (Blind/Referenceless Image Spatial Quality Evaluator) as an alternative — `pip install image-quality` provides this. BRISQUE scores differently (lower = better), so invert and normalize.

### 3.5 services/story_sequencer.py

This service arranges a set of selected photos into a narrative arc that tells the story of an event.

**EXIF timestamp parsing**: for each image, extract the DateTimeOriginal EXIF tag. Use `piexif.load(image_path)` and access `exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal]`. Decode the bytes to a string and parse with `datetime.strptime(value, "%Y:%m:%d %H:%M:%S")`. If EXIF is missing, fall back to the file's modification timestamp.

**Scene classification using CLIP**: OpenAI's CLIP model can match images to text descriptions. Import `open_clip` and load the `ViT-B-32` model. For each image, compute an embedding. Also compute text embeddings for scene labels: "wedding ceremony", "wedding reception", "wedding portraits", "outdoor group photo", "indoor celebration", "food and details", "candid moment", "formal portrait". The scene with the highest cosine similarity to the image embedding is the scene label for that photo.

**Narrative arc construction**: once you have timestamps and scene labels, arrange photos into the following structure:
- Opening (5–10% of photos): arrival shots, establishing wide shots, venue shots
- Build-up (20–30% of photos): preparation, rituals, emotional moments leading to the key event
- Climax (30–40% of photos): the main event — ceremony, first dance, cake cutting, key portraits
- Resolution (20–30% of photos): celebrations, group photos, send-off, candid joy

Within each section, alternate between wide shots (group scenes, venue) and close shots (details, expressions) to create visual rhythm. A "wide shot" is detected by counting faces — more than 3 faces = wide/group shot, 1–2 faces = intimate shot, 0 faces = detail shot.

**Chapter detection**: insert a chapter break when two consecutive photos differ in location (detected by GPS EXIF if available, or by scene label changing significantly) AND there is a time gap of more than 20 minutes.

```python
def sequence_photos(image_paths: list, scene_labels: dict, timestamps: dict) -> list:
    # Returns: ordered list of image_paths in narrative sequence

def detect_chapters(sequence: list, timestamps: dict, scene_labels: dict) -> list:
    # Returns: list of chapter boundaries (indices where a new chapter starts)
```

### 3.6 services/caption_generator.py

This service calls the Claude API to generate emotional, contextual captions for each photo.

**API call**: use the `anthropic` Python library. Initialize `client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))`. To pass an image, encode it as base64 and include it in the content array.

**Prompt structure**: the prompt should include (a) the encoded image, (b) context about the event type and surrounding photos, (c) the user's preferred caption style, and (d) language preference. Example prompt:

```
You are writing captions for a premium photo book. This is a {event_type} photo book.
The previous photo showed: {prev_context}
The next photo shows: {next_context}

Write a {style} caption for this photo in {language}. The caption should be 1–2 sentences.
Do not describe what is literally in the photo. Instead, capture the emotion and meaning.
Return only the caption text, no quotes, no labels.

Style options:
- poetic: lyrical, metaphorical, evocative
- factual: clear, warm, direct
- playful: lighthearted, joyful, occasionally witty
- minimal: 5–10 words maximum, elegant
```

**Caching**: store generated captions by image hash (the pHash from the duplicate removal step) in a local dictionary or Redis cache. If the same image is re-processed (user edits and re-submits), return the cached caption instead of making a new API call.

**Cost control**: at approximately $0.01 per caption (using claude-sonnet-4-6 with vision), a 50-page book with 60 photos costs $0.60. Always cache aggressively. Do not regenerate captions unless the image has actually changed.

```python
async def generate_caption(
    image_path: str,
    event_type: str,
    style: str = "poetic",
    language: str = "English",
    context: dict = None
) -> str:
    # Returns: caption string

async def generate_captions_batch(
    image_paths: list,
    event_type: str,
    style: str,
    language: str
) -> dict:
    # Returns: {image_path: caption_string}
```

### 3.7 services/photo_selector.py

This is the master orchestration service. It calls all the other services in the correct order and returns a final ranked, sequenced, captioned photo selection.

**Input**: a list of image paths (all uploaded photos), a target book size (number of pages), and user preferences (event type, caption style, language).

**Processing order**:
1. Run `score_image_quality()` on all images in parallel using `asyncio.gather()` or Python's `concurrent.futures.ThreadPoolExecutor`
2. Reject all images where `reject: True` from quality scorer
3. Run `detect_faces()` on all surviving images
4. Run `remove_duplicates()` and `cluster_by_time()` — from each cluster, keep only the best image
5. Run `score_aesthetic()` on surviving images
6. Compute final_rank for each image: `quality_score * 0.30 + face_score * 0.30 + aesthetic_score * 0.40`
7. Select top N images based on book size: 20-page = 25 photos, 40-page = 55 photos, 60-page = 80 photos, 80-page = 120 photos
8. When selecting, enforce diversity: at minimum 1 photo per scene type, at minimum 3 photos per key face cluster
9. Run `sequence_photos()` on the selected set to get narrative order
10. Run `detect_chapters()` to find chapter boundaries
11. Run `generate_captions_batch()` to generate all captions
12. Return the final ordered list with metadata

```python
async def run_full_pipeline(
    image_paths: list,
    book_size: str,  # "small", "medium", "large", "xl"
    event_type: str,
    caption_style: str,
    language: str
) -> dict:
    # Returns: {
    #   "selected_photos": [{"path": str, "caption": str, "chapter": int, "scene": str}],
    #   "total_input": int,
    #   "total_selected": int,
    #   "chapters": [{"title": str, "start_index": int}],
    #   "processing_time_seconds": float
    # }
```

### 3.8 services/s3_service.py

This service handles all AWS S3 operations.

**Upload a file**: use `boto3.client('s3')` initialized with credentials from environment variables. The `upload_fileobj()` method streams a file to S3 without loading it fully into memory. Set `ContentType` based on file extension.

**Generate pre-signed upload URL**: this is the correct pattern for large file uploads. The browser uploads directly to S3, not through your API server. Call `s3_client.generate_presigned_url('put_object', Params={'Bucket': bucket, 'Key': key, 'ContentType': 'image/jpeg'}, ExpiresIn=3600)`. Return this URL to the frontend. The frontend does a PUT request directly to this URL with the file as the body.

**Generate pre-signed download URL**: same but use `'get_object'` and a shorter expiry (300 seconds) for displaying images in the editor. Never make your S3 bucket public.

**S3 key naming convention**: organize all uploads under a consistent path structure:
- `uploads/{user_id}/{batch_id}/{filename}` for raw uploaded photos
- `processed/{order_id}/selected/{index}_{filename}` for AI-selected photos
- `books/{order_id}/preview.pdf` for the generated book preview
- `books/{order_id}/print_ready.pdf` for the print-ready file

```python
def generate_upload_url(user_id: str, batch_id: str, filename: str) -> dict:
    # Returns: {"url": str, "key": str, "expires_in": 3600}

def generate_download_url(s3_key: str, expires_in: int = 300) -> str:
    # Returns: pre-signed URL string

def delete_batch(batch_prefix: str) -> bool:
    # Deletes all files under a prefix (for cleanup/failed orders)
```

---

## PART 4 — DATABASE SCHEMA

### 4.1 Create Tables in Supabase

Go to the Supabase dashboard, open your project, go to the SQL Editor, and run each of the following CREATE TABLE statements.

**users table**: Supabase Auth automatically creates a `auth.users` table. Create a public `profiles` table that mirrors it with additional fields:

```sql
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  phone text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
```

**orders table**:

```sql
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'draft',
  -- status values: draft, paid, processing, printing, qc, shipped, delivered, refunded
  book_type text not null,
  -- book_type: wedding, baby, travel, corporate, festival, classic
  tier text not null,
  -- tier: good (₹999), better (₹2499), best (₹4999), ultra (₹9999)
  page_count integer,
  total_price integer not null,  -- in paise (₹2499 = 249900)
  caption_style text default 'poetic',
  language text default 'English',
  shipping_name text,
  shipping_address text,
  shipping_city text,
  shipping_pincode text,
  shipping_phone text,
  estimated_delivery date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders enable row level security;

create policy "Users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create index on public.orders(user_id);
create index on public.orders(status);
```

**photo_batches table**:

```sql
create table public.photo_batches (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  s3_prefix text not null,
  total_uploaded integer default 0,
  total_processed integer default 0,
  ai_status text default 'pending',
  -- ai_status: pending, running, completed, failed
  ai_progress integer default 0,  -- 0–100
  pipeline_result jsonb,  -- stores full pipeline output
  created_at timestamptz default now()
);

alter table public.photo_batches enable row level security;

create policy "Users can access own batches"
  on public.photo_batches for all
  using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );
```

**photos table**:

```sql
create table public.photos (
  id uuid default gen_random_uuid() primary key,
  batch_id uuid references public.photo_batches(id) on delete cascade not null,
  s3_key text not null,
  original_filename text,
  quality_score float,
  face_score float,
  aesthetic_score float,
  final_rank float,
  is_selected boolean default false,
  sequence_index integer,
  chapter_index integer,
  scene_label text,
  caption text,
  ai_caption text,  -- original AI caption, in case user edits
  created_at timestamptz default now()
);

alter table public.photos enable row level security;

create policy "Users can access own photos"
  on public.photos for all
  using (
    auth.uid() = (
      select o.user_id from public.orders o
      join public.photo_batches pb on pb.order_id = o.id
      where pb.id = batch_id
    )
  );

create index on public.photos(batch_id);
create index on public.photos(batch_id, final_rank desc);
create index on public.photos(batch_id, is_selected);
```

**payments table**:

```sql
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  razorpay_signature text,
  amount integer not null,  -- in paise
  status text default 'created',
  -- status: created, paid, failed
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;

create policy "Users can read own payments"
  on public.payments for select
  using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );
```

**shipments table**:

```sql
create table public.shipments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  courier text,
  waybill_number text,
  tracking_url text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

alter table public.shipments enable row level security;

create policy "Users can read own shipments"
  on public.shipments for select
  using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );
```

### 4.2 Enable Realtime

In the Supabase dashboard, go to Database > Replication. Enable realtime for the `orders` table and the `photo_batches` table. This allows the frontend to get live status updates without polling.

### 4.3 utils/supabase_client.py

```python
from supabase import create_client, Client
import os

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")  # Service key for backend
    return create_client(url, key)

supabase = get_supabase()
```

---

## PART 5 — API ROUTES

### 5.1 routes/upload.py

This route generates pre-signed S3 URLs for direct browser-to-S3 uploads.

```
POST /upload/init
Body: { "order_id": str, "file_count": int, "event_type": str }
Response: { "batch_id": str, "upload_urls": [{"filename": str, "url": str, "s3_key": str}] }
```

Logic: create a photo_batch record in Supabase, generate one pre-signed S3 upload URL per file, return all URLs. The frontend will upload each file directly to its URL.

```
POST /upload/confirm
Body: { "batch_id": str, "uploaded_keys": [str] }
Response: { "success": bool, "total_confirmed": int }
```

Logic: create a photo record in Supabase for each confirmed S3 key. Update the `total_uploaded` count on the batch.

### 5.2 routes/analyze.py

```
POST /analyze/{batch_id}
Body: { "book_size": str, "caption_style": str, "language": str }
Response: { "job_id": str, "status": "queued" }
```

Logic: add the pipeline job to the BullMQ Redis queue. Return a job ID immediately so the client can poll for status. Do not run the AI pipeline synchronously — it takes 2–4 minutes and will time out HTTP connections.

```
GET /analyze/status/{batch_id}
Response: { "status": str, "progress": int, "eta_seconds": int }
```

Logic: query the photo_batch record in Supabase for `ai_status` and `ai_progress`. Return current state.

```
GET /analyze/result/{batch_id}
Response: { "selected_photos": [...], "chapters": [...], "total_selected": int }
```

Logic: query the photos table for the batch, filtering `is_selected = true`, ordered by `sequence_index`. Return with captions.

### 5.3 Background Worker (queue processor)

Create `worker.py` in the root of the backend:

```python
import asyncio
from utils.queue import get_queue
from services.photo_selector import run_full_pipeline
from utils.supabase_client import supabase

async def process_job(job):
    batch_id = job.data["batch_id"]
    
    # Update status to running
    supabase.table("photo_batches").update(
        {"ai_status": "running", "ai_progress": 0}
    ).eq("id", batch_id).execute()
    
    # Get all photo S3 keys for this batch
    photos = supabase.table("photos").select("*").eq("batch_id", batch_id).execute()
    image_paths = [p["s3_key"] for p in photos.data]
    
    # Run full AI pipeline
    result = await run_full_pipeline(
        image_paths=image_paths,
        book_size=job.data["book_size"],
        event_type=job.data["event_type"],
        caption_style=job.data["caption_style"],
        language=job.data["language"]
    )
    
    # Save results to Supabase
    for i, photo in enumerate(result["selected_photos"]):
        supabase.table("photos").update({
            "is_selected": True,
            "sequence_index": i,
            "caption": photo["caption"],
            "scene_label": photo["scene"],
            "chapter_index": photo["chapter"]
        }).eq("s3_key", photo["path"]).execute()
    
    # Mark batch as completed
    supabase.table("photo_batches").update({
        "ai_status": "completed",
        "ai_progress": 100,
        "pipeline_result": result
    }).eq("id", batch_id).execute()

# Run: python worker.py
if __name__ == "__main__":
    queue = get_queue("ai-pipeline")
    queue.process("ai-pipeline", process_job)
    asyncio.run(queue.run())
```

### 5.4 routes/payments.py

```
POST /payments/create-order
Body: { "order_id": str }
Response: { "razorpay_order_id": str, "amount": int, "currency": "INR" }
```

Logic: look up the order total from Supabase, call Razorpay's Orders API to create a payment order, save the `razorpay_order_id` to the payments table, return to frontend.

```
POST /payments/verify
Body: { "razorpay_order_id": str, "razorpay_payment_id": str, "razorpay_signature": str }
Response: { "success": bool }
```

Logic: verify the payment signature using HMAC-SHA256. The signature is computed as `HMAC(razorpay_order_id + "|" + razorpay_payment_id, key=RAZORPAY_KEY_SECRET)`. If the computed signature matches the received signature, the payment is genuine. Update the payment status to `paid`, update the order status to `paid`, trigger the post-payment notifications.

**Critical**: never trust the frontend to say a payment succeeded. Always verify the signature on the server. A mismatch means someone tried to fake a payment.

```python
import hmac
import hashlib

def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    message = f"{order_id}|{payment_id}"
    secret = os.getenv("RAZORPAY_KEY_SECRET").encode()
    computed = hmac.new(secret, message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
```

### 5.5 Post-payment Notifications

Create `services/notifications.py`:

**Email via Resend**: import `resend`, set `resend.api_key`. Call `resend.Emails.send()` with `from`, `to`, `subject`, and `html` body. The order confirmation email should include the order ID, book type, tier, estimated delivery date, and a link to the order tracking page.

**WhatsApp via Twilio**: import `twilio.rest.Client`. Initialize with account SID and auth token. Call `client.messages.create(from_='whatsapp:+14155238886', to=f'whatsapp:{customer_phone}', body='Your MemoryLane photo book is being created! Order #{order_id}. Estimated delivery: {delivery_date}.')`.

---

## PART 6 — NEXT.JS FRONTEND

### 6.1 Project Setup

```
npx create-next-app@latest memorylane-frontend --typescript --tailwind --app --src-dir
cd memorylane-frontend
npx shadcn@latest init
```

When shadcn asks for configuration, choose: style = Default, base color = Neutral, CSS variables = yes.

Install additional dependencies:

```
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs
pnpm add react-dropzone fabric konva react-konva
pnpm add react-page-flip framer-motion
pnpm add zustand @tanstack/react-query
pnpm add axios
```

### 6.2 Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Create `src/lib/api.ts` for calling your FastAPI backend:

```typescript
import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})
```

### 6.3 Page Structure

Create the following pages under `src/app/`:

```
src/app/
├── page.tsx                   # Homepage
├── layout.tsx                 # Root layout with Navbar
├── login/page.tsx             # Login / signup
├── create/
│   ├── page.tsx               # Book type selector (Step 1)
│   ├── [type]/page.tsx        # Size and tier selector (Step 2)
│   └── upload/page.tsx        # Upload + AI flow (Steps 3–8)
├── checkout/page.tsx          # Add-ons + payment (Steps 9–10)
├── orders/
│   ├── page.tsx               # Order history list
│   └── [id]/page.tsx          # Order detail + tracking
└── admin/
    ├── page.tsx               # Admin dashboard (password protected)
    └── orders/page.tsx        # Order queue
```

### 6.4 Homepage (src/app/page.tsx)

The homepage is a marketing page. It should have:

**Hero section**: a full-width area with a headline ("Turn 500 photos into one perfect book"), a subheadline ("AI picks the best, sequences the story, writes the captions — printed and delivered in 5 days"), and a primary CTA button ("Create your book"). Behind it, use a large, high-quality photo of someone receiving a MemoryLane box and looking emotional.

**How it works**: three steps shown as cards with icons — (1) Upload your photos, (2) AI curates and designs, (3) Printed and delivered.

**Product tiers**: four pricing cards side by side (or stacked on mobile):
- Good: ₹999, softcover, 30 pages, AI curation
- Better: ₹2,499, hardcover, 50 pages, premium paper
- Best: ₹4,999, signature hardcover, 80 pages, fine art paper
- Ultra: ₹9,999, heirloom edition, 120 pages, leather cover

**Sample books gallery**: an image grid or horizontal scroll showing photos of printed books — inside pages, covers, packaging.

**Reviews**: three to five customer review cards with a star rating, quote, and name.

**FAQ**: accordion-style list answering common questions (delivery time, photo quality, AI errors, refund policy).

### 6.5 Upload and AI Flow (src/app/create/upload/page.tsx)

This is the most complex page. It is a multi-step flow managed with local React state.

**Step management**: use a `useState` hook to track `currentStep` (0–7). Render a different component based on the step. Show a progress indicator at the top (breadcrumb or step dots).

**Step 0 — photo upload**:
Use `react-dropzone` with `accept={{ 'image/jpeg': [], 'image/png': [] }}` and `maxFiles={500}`. As files are selected, show a grid of thumbnails (use `URL.createObjectURL()` for instant preview before upload). Show a file count and estimated size.

On "Upload" click: call `POST /upload/init` to get pre-signed URLs, then upload each file directly to its S3 URL using `fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } })`. Show a progress bar tracking how many files have been uploaded. After all uploads, call `POST /upload/confirm`.

**Step 1 — AI processing screen**:
Show an animated progress screen. Poll `GET /analyze/status/{batch_id}` every 3 seconds. Show the current `ai_progress` value as a progress bar. Show rotating status messages like "Detecting faces...", "Scoring 312 photos...", "Building your story...", "Writing captions...". When status becomes `completed`, automatically advance to the next step.

**Step 2 — AI selection review**:
Call `GET /analyze/result/{batch_id}` to get the selected photos. Show a grid with the AI-selected photos. For each photo, show a checkbox and the AI's score. Allow the user to uncheck photos they don't want, and check unselected photos to add them. Show a count: "43 of 312 photos selected".

**Step 3 — interactive book preview**:
Use `react-page-flip` (the `HTMLFlipBook` component) to show a page-turn preview of the book. Each spread (two pages) shows the photos assigned to those pages in the AI-generated layout. Show the AI caption beneath each photo. Allow the user to click on a caption to edit it inline.

**Step 4 — editor**:
Show a simplified layout editor. For each page spread, show the current layout (photo arrangement) and a row of alternative template thumbnails below. When the user clicks a different template, re-render the spread with that layout. Allow photo swap: user can click any photo slot to open a photo picker showing the full uploaded set.

**Step 5 — add-ons**:
Show a list of optional upgrades with toggle switches:
- Rush delivery (48 hours): +₹299
- Gift wrapping + message card: +₹149
- Extra copy (same book): +40% of book price
- Canvas print of best photo: +₹599
- Engraved cover (name/date): +₹249

Update the order total in real time as toggles change.

**Step 6 — address and checkout**:
Show a form: shipping name, phone, address line 1, address line 2, city, state, pincode. Validate that pincode is 6 digits. Call `POST /payments/create-order` to get a Razorpay order ID. Then load the Razorpay checkout:

```javascript
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  amount: totalAmountInPaise,
  currency: "INR",
  order_id: razorpayOrderId,
  name: "MemoryLane",
  description: `${bookType} Photo Book`,
  handler: async (response) => {
    await api.post('/payments/verify', response)
    router.push(`/orders/${orderId}?success=true`)
  },
  prefill: { name: userName, contact: userPhone, email: userEmail },
  theme: { color: "#1B2A4A" }
}
const rzp = new window.Razorpay(options)
rzp.open()
```

Load the Razorpay script in the root layout: `<Script src="https://checkout.razorpay.com/v1/checkout.js" />`

**Step 7 — confirmation**:
Show the order ID, expected delivery date, and a "Track your order" button. Show a WhatsApp opt-in checkbox if the user hasn't provided their phone number yet.

### 6.6 Order Tracking (src/app/orders/[id]/page.tsx)

Subscribe to realtime updates from Supabase for the order record:

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    }, (payload) => {
      setOrder(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [orderId])
```

Show a vertical timeline with steps: Payment confirmed → Book being created → Printing → Quality check → Packed → Shipped → Delivered. Highlight the current step. Show the courier name and tracking link when available.

### 6.7 Auth (src/app/login/page.tsx)

Use Supabase's Magic Link (passwordless email) as the primary login method. Show a single email input field and a "Send login link" button. Call `supabase.auth.signInWithOtp({ email })`. Show a confirmation message: "Check your email — we sent you a login link."

Also show a phone OTP option for Indian users: input phone number, call `supabase.auth.signInWithOtp({ phone: '+91' + phoneNumber })`, then show a 6-digit OTP input.

Create a middleware at `src/middleware.ts` to protect routes: redirect to `/login` if the user is not authenticated and tries to access `/create`, `/checkout`, or `/orders`.

### 6.8 Admin Dashboard (src/app/admin/page.tsx)

This page is for internal use only. Protect it with a simple hardcoded admin password stored as an environment variable — not a Supabase role — for now, because you don't want to set up admin roles before launch.

Show a table of all orders with columns: Order ID, Customer name, Book type, Tier, Status, Amount, Created date. Allow filtering by status using tab buttons. For each order, a "View" button opens the order detail in a side panel.

Order detail panel shows: the selected photos (thumbnails), the shipping address, a "Download print PDF" button, a status dropdown to manually update the order status, and a "Generate waybill" button that calls the Shiprocket API.

Show a revenue summary at the top: today's orders, today's revenue, this month's revenue.

---

## PART 7 — INFRASTRUCTURE AND DEPLOYMENT

### 7.1 AWS S3 Setup

In the AWS console:
- Create a bucket named `memorylane-photos` in the `ap-south-1` (Mumbai) region
- Block all public access (leave all four checkboxes checked)
- Enable versioning
- Set a lifecycle rule: objects under the `uploads/` prefix that have not been accessed in 30 days are deleted
- Set the CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Create a CloudFront distribution pointing to this S3 bucket for fast delivery of images to the book editor. Set the origin to the S3 bucket, restrict access (only CloudFront can read the bucket), and set the default cache TTL to 86400 seconds (1 day).

### 7.2 Deploy Backend to Railway

In the Railway dashboard, create a new project. Add a Redis service from the Railway templates. Add a new service from your GitHub repo `memorylane-backend`. Railway will detect it as a Python project.

Add a `Procfile` in the backend root:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
worker: python worker.py
```

Railway will run both processes. Add all environment variables from your `.env` file in the Railway service settings. Railway will give you a deployment URL like `memorylane-backend-production.up.railway.app`.

### 7.3 Deploy Frontend to Vercel

Connect your `memorylane-frontend` GitHub repo in the Vercel dashboard. Vercel auto-detects Next.js. Add all environment variables from `.env.local` in the Vercel project settings. Update `NEXT_PUBLIC_API_URL` to your Railway backend URL. Every push to the `main` branch automatically deploys.

### 7.4 Error Tracking with Sentry

In `memorylane-backend`, install `pip install sentry-sdk[fastapi]`. Add to `main.py`:

```python
import sentry_sdk
sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1)
```

In `memorylane-frontend`, install `pnpm add @sentry/nextjs` and run `npx @sentry/wizard@latest -i nextjs`. This adds Sentry config files automatically. Sentry's free tier captures 5,000 errors per month, which is sufficient for the first year.

---

## PART 8 — TESTING CHECKLIST

Run these tests manually before going live. Do not skip any of them.

**AI pipeline tests**:
- Upload 300 photos from your own phone (mixed quality, duplicates included) and run the full pipeline. Verify that blurry, dark, and duplicate photos are removed. Verify that the selected set looks like a coherent story.
- Upload 500 wedding photos (borrow from a photographer friend or use Creative Commons images). Verify face clustering identifies unique individuals. Verify the narrative arc makes sense — ceremony before reception before send-off.
- Verify caption quality on 20 diverse images. Check that captions are emotional and contextual, not generic.
- Measure processing time. A batch of 300 photos should complete in under 3 minutes on your Railway deployment.

**Payment flow tests**:
- Use Razorpay test card `4111 1111 1111 1111`, expiry `12/25`, CVV `123` to test a successful payment. Verify the order status updates in Supabase. Verify the email confirmation arrives. Verify the WhatsApp message arrives.
- Use Razorpay test card `4000 0000 0000 0002` to simulate a payment failure. Verify the order stays in `draft` status. Verify the user sees an appropriate error message.
- Manually tamper with the Razorpay signature in the verify endpoint to confirm it correctly rejects invalid signatures.

**Upload tests**:
- Upload 500 photos simultaneously from a browser on mobile data and verify all 500 upload successfully (no silent failures). Resumable uploads via tus.io handle interruptions — pause mid-upload and resume to confirm.
- Upload a file with an unsupported extension (PDF, video). Verify it is rejected.
- Upload an image that is 100KB (too low resolution). Verify the quality scorer rejects it.

**Frontend tests**:
- Open the site on an iPhone 14, Galaxy S23, and iPad. All pages must be fully usable. The book editor especially — verify that Fabric.js canvas works on touch.
- Test the full flow on a slow 4G connection (use Chrome DevTools throttling). All loading states must be visible and informative.

**Security tests**:
- Try to access `/admin` without the admin password. Verify you are blocked.
- In the browser console, try to call `GET /analyze/result/{someone_elses_batch_id}`. Verify you get a 403 or empty result (Supabase RLS prevents data leaks).
- Verify that the S3 bucket URLs return 403 without a pre-signed token. Never expose a direct S3 URL.

---

## PART 9 — LAUNCH SEQUENCE

Do these steps in this exact order. Do not skip any step.

1. Complete all items in the testing checklist above.
2. Switch Razorpay from test mode to live mode — update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Railway environment variables.
3. Create 20 sample books using your own photos (spend 2 days on this). These are your product photography assets for the website and Instagram.
4. Update the homepage with real sample book photos. Remove any placeholder content.
5. Set up Google Analytics 4: go to analytics.google.com, create a property, add the tracking code to `src/app/layout.tsx`.
6. Set up Meta Pixel: go to business.facebook.com, create a pixel, add it to `layout.tsx`. Add the `Purchase` event trigger in the order confirmation page.
7. Set up Google Search Console: verify domain ownership, submit your sitemap.
8. Place 3 test orders yourself with real money. Verify the full production flow end-to-end — upload, AI, payment, print, pack, ship.
9. Fix any issues found in step 8.
10. Share the live URL with 10 trusted people (friends, family, photographers). Ask them to place real orders.
11. Collect feedback. Fix the top 3 issues they report.
12. Post the launch announcement on your personal Instagram, LinkedIn, and WhatsApp status.
13. Gift books to 5 Instagram nano-influencers (10K–50K followers in wedding or mom niches) in exchange for an unboxing reel.
14. Turn on the first Meta ad campaign: ₹500/day, emotional video creative, target audience = married women 25–35 in metro cities.

---

## PART 10 — REFERENCE: KEY NUMBERS

Use these numbers when configuring the system:

- Book sizes: 20–30 pages = 25–35 AI-selected photos; 40–60 pages = 55–80 photos; 80–120 pages = 100–180 photos
- Quality reject threshold: final_quality_score < 30
- pHash duplicate threshold: Hamming distance ≤ 8
- SSIM duplicate threshold: score ≥ 0.85
- Face cluster similarity: cosine similarity ≥ 0.60
- Processing time target: < 3 minutes for 300 photos
- Caption cost: ~$0.01 per caption (Claude API, Sonnet 4.6)
- S3 storage cost: ~₹900/month at 500 GB
- Infrastructure total (months 1–6): ₹8,000–₹16,000/month
- GST on photo books: 12% (HSN code 4901)
- Payment gateway fee: 2% (Razorpay standard), negotiate to 1.5% above ₹10L/month volume
- Delivery SLA: 5–7 business days standard, 48 hours rush

---

*This document was generated from the MemoryLane Business Blueprint 2026. It covers only the software execution — printing setup, legal registration, and marketing are covered separately in the full blueprint.*
