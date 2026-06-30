# MemoryLane Backend Deployment Guide (Railway)

This document provides instructions for deploying the FastAPI backend and Redis worker to Railway.

## Prerequisites
1. A Railway account.
2. A database instance running in Supabase.
3. An S3 bucket created on AWS.

## Step 1: Create a Railway Project
1. Log in to [Railway](https://railway.app).
2. Click **New Project** > **Deploy from GitHub repo** > select `memorylane-backend`.
3. Add a **Redis** database service to the same project (New > Database > Redis). Railway will automatically inject the `REDIS_URL` environment variable.

## Step 2: Configure Environment Variables
In the FastAPI service's **Variables** tab, add the following variables:

```env
ENV=production
PORT=8000
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_KEY=your-service-role-secret-key

# Storage (AWS S3)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your_s3_bucket_name

# Payments (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# AI Models (Google AI Studio / Anthropic)
GEMINI_API_KEY=your_google_studio_api_key
# ANTHROPIC_API_KEY=your_claude_api_key (optional, fallback)

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
```

## Step 3: Deploy the Services
Railway reads the `Procfile` and will automatically provision two services:
1. **FastAPI Web Service**: Running `uvicorn main:app --host 0.0.0.0 --port $PORT`.
2. **Background Task Worker**: Running `python worker.py` as a worker service.

Ensure both services are active and the web service is exposed to a public URL. Update the frontend `NEXT_PUBLIC_API_URL` variable with this backend URL.
