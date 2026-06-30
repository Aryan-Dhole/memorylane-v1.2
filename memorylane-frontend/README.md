# 🎨 MemoryLane Frontend Client

This is the Next.js-based web client for MemoryLane. It delivers a highly interactive, responsive e-commerce and media review interface, allowing users to authenticate, drag-and-drop photos, view real-time AI processing progress, edit layout compositions, customize captions, and checkout via Razorpay.

---

## 🚀 Key Technologies & Libraries

- **Framework**: Next.js App Router (utilizing Server Components, metadata optimization, and server action hooks).
- **Styling**: Tailwind CSS v4 with custom variable utilities, plus components from Shadcn UI.
- **Client State**: Zustand (for unified UI control states, dropzone queues, and checkout processes) + TanStack React Query (for server sync & caching).
- **Animations**: Framer Motion, GSAP, and Lenis for smooth scroll physics, page transitions, and interactive visual grids.
- **Interactive Canvas & Book Rendering**:
  - `react-pageflip`: Creates the book flipping effect simulating a physical photo book.
  - `fabric.js` & `react-konva`: Provides drag-and-drop crop controls, canvas alignments, and custom image positioning.
- **File Uploading**: `react-dropzone` for secure drag-and-drop file ingestion, directly pipeline-routed to S3.

---

## 📂 Frontend File Architecture

```
memorylane-frontend/
├── src/
│   ├── app/                  # Next.js App Router (Pages, layout, global providers)
│   │   ├── auth/             # Sign-in pages, Google redirects, verification forms
│   │   ├── gallery/          # Public responsive live album viewer
│   │   ├── order/            # Checkout, address form, and configuration options
│   │   └── trial/            # Instant upload & trial preview page
│   ├── components/           # Reusable UI component blocks
│   │   ├── ui/               # Core Shadcn primitives (Button, Input, Dialog, etc.)
│   │   ├── album/            # Interactive Pageflip book component
│   │   ├── canvas/           # Konva/Fabric layout editor boards
│   │   └── uploader/         # Drag-and-drop S3 direct upload queue UI
│   ├── hooks/                # Custom React hooks (Supabase auth session, query wrappers)
│   ├── store/                # Zustand global slices for active state management
│   └── utils/                # S3 upload helpers and API client configurations
├── public/                   # Static icons and assets
├── next.config.ts            # Next.js configuration settings
├── tsconfig.json             # TypeScript configuration
├── package.json              # Client packages and runtime scripts
└── DEPLOY.md                 # Production deployment (Vercel) instructions
```

---

## ⚙️ Environment Configuration

To run the frontend locally, create a `.env.local` file in the root of the `memorylane-frontend` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key      # Retrievable from your Supabase API settings

# Razorpay Checkout Credentials
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_yourkey             # Placed on client to launch checkout overlays

# Backend Endpoint (Railway domain in production)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 💻 Local Development

### 1. Prerequisite Installations
Make sure you have Node.js 20 LTS installed. This project uses `pnpm` for package management:
```bash
npm install -g pnpm
```

### 2. Install Dependencies
Run the installation command inside the frontend folder:
```bash
pnpm install
```

### 3. Spin Up Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to view the application.

---

## 🛠️ Build & Verification Command Scripts

- **Development Build**: `pnpm dev`
- **Production Build Check**: `pnpm build` (Compiles TypeScript files, verifies components, outputs server bundle outputs)
- **Linting & Code Style**: `pnpm lint`

---

## 🔒 Authentication Flow
MemoryLane uses cookie-based sessions backed by `@supabase/ssr` to ensure server components are hydrated with active user credentials securely. 

When a user logs in (via OTP or Google OAuth callback), a code exchange occurs at `/auth/callback` which sets secure HTTPS cookies. This allows middleware checks to secure routes (like `/order` and `/dashboard`) server-side, preventing client-side flashing or unauthorized data leakage.
