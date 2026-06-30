# 🚢 MemoryLane Frontend Deployment Guide (Vercel)

This document provides step-by-step instructions for deploying the Next.js React frontend to production using **Vercel**, linking to authentication domains, and configuring cross-origin (CORS) whitelists.

---

## 📋 Infrastructure Prerequisites

Before deploying the frontend, ensure you have:
1. A deployed and running backend API gateway (e.g. hosted on **Railway**).
2. A configured **Supabase Project** with authentication settings active.
3. A **Vercel account** connected to your project's GitHub repository.

---

## ⚡ Step-by-Step Deployment on Vercel

### 1. Import Project
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import the `memorylane-frontend` directory from your repository.

### 2. Configure Project Framework
- **Framework Preset**: Select **Next.js**.
- **Root Directory**: Select `memorylane-frontend` if your repository is structured as a monorepo workspace.
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

### 3. Add Environment Variables
Add the following variables under the **Environment Variables** tab before launching the deployment:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[id].supabase.co` | Supabase API Endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `your_anon_key` | Public Supabase Key |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_live_yourkey` | Live Razorpay Client Key |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.up.railway.app` | Railway API endpoint (without trailing slash) |

Click **Deploy**. Vercel will bundle production pages, run optimizations, and provision a SSL certificate for your new deployment.

---

## 🔒 Step-by-Step OAuth & Domain Whitelisting (Crucial)

Once Vercel generates your deployment URL (e.g., `https://memorylane.vercel.app`), configure other services to authorize it:

### A. Google Cloud Console Redirects
To ensure Google OAuth login functions correctly in production:
1. Go to the [Google Cloud Console Credentials Dashboard](https://console.cloud.google.com/apis/credentials).
2. Click on your active OAuth 2.0 Client ID.
3. Add the following redirect paths to **Authorized redirect URIs**:
   ```
   https://[your-supabase-project-id].supabase.co/auth/v1/callback
   https://your-frontend-domain.vercel.app/auth/callback
   ```
4. Click Save.

### B. Supabase Redirect URL Allowlist
Supabase Auth requires explicit authorization for redirect origins:
1. Go to the [Supabase Dashboard Authentication Settings](https://supabase.com/dashboard/project/_/auth/url-configuration).
2. In **Site URL**, enter your primary Vercel production domain: `https://your-frontend-domain.vercel.app`
3. In **Additional Redirect URLs**, add:
   ```
   https://your-frontend-domain.vercel.app/**
   ```
4. Click Save.

### C. Backend API CORS Whitelisting
To prevent cross-origin fetch failures:
1. Open your **Railway** backend dashboard.
2. Select your FastAPI service and go to the **Variables** tab.
3. Update the `FRONTEND_URL` environment variable to match your exact Vercel production domain (e.g. `https://your-frontend-domain.vercel.app`). Do not append a trailing slash.
4. Redeploy the backend to reload configurations.

---

## 📈 Post-Deployment Performance & SEO Verification

- **Hydration Safety**: Ensure components that rely on global states (like Zustand uploads or Konva canvas wrappers) check if `window` is defined before rendering to avoid Next.js SSR hydration mismatches.
- **Web Vitals**: Monitor pages using Vercel Speed Insights to track Largest Contentful Paint (LCP) and Cumulative Layout Shift (CLS) on dynamic galleries.
