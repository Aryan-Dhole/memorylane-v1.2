# ⚙️ MemoryLane Backend Service

This is the Python-based FastAPI backend and background task worker for MemoryLane. It handles photo analysis, face clustering, e-commerce checkouts, image sequence compilation, and transactional notifications.

---

## 🛠️ Tech Stack & Key Libraries

- **Framework**: FastAPI (high performance, ASGI-native web framework).
- **Web Server**: Uvicorn (standard ASGI server implementation).
- **Database Client**: `supabase-py` (interacts with Supabase PostgreSQL and handles RLS policies).
- **Asynchronous Task Queue**: Redis + custom worker interface (fallbacks to a native asyncio task loop in non-Redis/low-resource local environments).
- **AI Core (dynamic fallback)**: `InsightFace`, `DeepFace`, `Pillow`, and `imagehash` for facial analysis, deduplication, and emotion processing.
- **Generative Captions**: Google AI Studio Gemini API and Anthropic SDK (as a robust fallback).
- **Payments & Notifications**: Razorpay integration, Resend (for system emails), and Twilio (for WhatsApp messaging).

---

## 📂 Backend File Architecture

```
memorylane-backend/
├── main.py                  # FastAPI server entry point, CORS, lifespan, routes mounting
├── worker.py                # Asynchronous worker script executing the AI pipeline and triggers
├── requirements.txt         # Package dependencies
├── .env.example             # Configuration variables blueprint
├── schema.sql               # Production database schemas and RLS definitions
├── models/
│   └── schemas.py           # Pydantic data schemas for requests and responses
├── routes/                  # API endpoints grouped by subdomain
│   ├── upload.py            # Image file uploads and S3 presigned URL generation
│   ├── analyze.py           # Starts background AI curating pipelines and checks status
│   ├── gallery.py           # Live web gallery access, reaction logs, and metadata querying
│   ├── orders.py            # Custom order management and details
│   ├── payments.py          # Razorpay payment verification webhooks and checkout sessions
│   ├── trial.py             # Instantiates anonymous trials for album generation previews
│   └── photographer.py      # Studio configuration management
├── services/                # Business logic engines
│   ├── s3_service.py        # Object uploading, key checks, and presigned requests
│   ├── face_detector.py     # Facial detection, gender, age, emotion heuristics
│   ├── quality_scorer.py    # Resolution, exposure, focus, and blur check algorithms
│   ├── duplicate_remover.py # Deduplication engine using perceptual hashing (pHash)
│   ├── story_sequencer.py   # Arranges images chronologically via EXIF data metadata
│   ├── caption_generator.py # Formulates rich AI descriptions of moments
│   └── notifications.py     # Resend email templates and Twilio WhatsApp dispatch logs
└── utils/
    ├── supabase_client.py   # Global Supabase client wrapper
    ├── limiter.py           # SlowAPI rate limiter setup
    └── queue.py             # Redis client and task queue client
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root of the backend folder (`memorylane-backend/.env`). Use the template below:

```env
# System State
ENV=development                  # set to 'production' to enforce strict CORS and secure endpoints
PORT=8000
FRONTEND_URL=http://localhost:3000

# Supabase Configurations
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key   # KEEP PRIVATE: overrides RLS rules on backend

# AWS S3 Storage Configs
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=memorylane-photos

# AI Service Keys
GEMINI_API_KEY=your_google_ai_studio_key
ANTHROPIC_API_KEY=your_anthropic_api_key       # Fallback for caption generation

# Payments (Razorpay)
RAZORPAY_KEY_ID=rzp_test_yourkey
RAZORPAY_KEY_SECRET=your_secret_key

# Notifications (Email & WhatsApp)
RESEND_API_KEY=re_your_key
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Asynchronous Tasks (Redis)
REDIS_URL=redis://localhost:6379              # Omit/leave blank to trigger in-memory queue fallback
```

---

## 🚀 Running Locally

### 1. Set Up Environment

Use a virtual environment tool (such as Anaconda or virtualenv) to organize packages:

**Using Anaconda:**
```bash
conda create -n memorylane python=3.11 -y
conda activate memorylane
pip install -r requirements.txt
```

**Using Venv:**
```bash
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On Linux/macOS
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the Web Server

Launch the FastAPI gateway locally:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
The interactive Swagger API documentation will be accessible at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Run the Background Queue Worker

If running with a Redis instance (recommended for production):
```bash
python worker.py
```
> [!NOTE]
> **Zero-Redis / Development Mode:** If `REDIS_URL` is omitted from `.env` or Redis is offline, the backend dynamically falls back to an in-app async `asyncio` task loop inside the main application process. In this configuration, you **do not** need to spin up a separate `worker.py` process.

---

## 🧠 ML Dependency Fallbacks

Heavy ML dependencies (`opencv-python`, `deepface`, `insightface`, `tensorflow`, `scikit-image`, `open-clip-torch`) are configured with dynamic loading fail-safes. 

If these packages are not installed, the application falls back to a deterministic, hash-based mock engine that mimics facial structures and aesthetic outputs. This allows frontend and integration developers to build on top of MemoryLane without needing high-performance local GPU cards or facing installation issues.

---

## 🧪 Testing

To run the automated API and helper test suite:
```bash
pytest
```
All route tests are located in [test_api.py](file:///c:/Users/aryan/OneDrive/Desktop/Up%20Stack/ML/memorylane-backend/test_api.py).
