# Google OAuth Setup Guide

To enable Google one-click sign-in for MemoryLane, follow these steps to generate client credentials and hook them up in the Supabase Dashboard.

---

### Step 1: Google Cloud Console Setup
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project called **MemoryLane**.
3. Navigate to **APIs & Services** → **OAuth consent screen**:
   * Select **External** user type and click Create.
   * Provide the app name (*MemoryLane*), support email, and developer contact details.
4. Navigate to **Credentials** → **Create Credentials** → **OAuth client ID**:
   * Select **Web application** as application type.
   * Add the following under **Authorized redirect URIs**:
     ```
     https://[your-supabase-project-id].supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
5. Click Save. Copy the generated **Client ID** and **Client Secret**.

---

### Step 2: Supabase Dashboard Configuration
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to your project settings, then go to **Authentication** → **Providers** → **Google**:
   * Toggle **Enable Google Provider** to ON.
   * Paste the **Client ID** and **Client Secret** copied from Google Cloud Console.
3. Click Save.

---

### Step 3: Local Development
Supabase Auth will handle the redirect flow. No new environment variables are needed on the frontend or backend.
* Login redirect handles user sessions dynamically via `/auth/callback` code exchanges.
