"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-24 px-6 md:px-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-12 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Home</span>
        </Link>

        <header className="mb-16">
          <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-[#c9a96e] block mb-3">Legal & Compliance</span>
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none mb-4 text-zinc-900">Privacy Policy</h1>
          <p className="text-xs text-zinc-400 font-geist-mono uppercase tracking-wider">Last Updated: July 1, 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none text-zinc-650 text-sm font-light leading-relaxed space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">1. Introduction</h2>
            <p>
              Welcome to MemoryLane ("we", "our", or "us"). We are committed to protecting the privacy of your private moments and event memories. This Privacy Policy details how we collect, use, process, and protect your personal information and media uploads when using our private event gallery services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Event Media & Metadata:</strong> When you or your guests upload photos, we store the image files along with their EXIF metadata (such as timestamp, camera model, and location offsets) to enable chronological story sequencing and quality filtering.
              </li>
              <li>
                <strong>AI Curation Assets:</strong> We generate localized data, facial clusters, bounding box crops, and automated caption details using Google Gemini Vision APIs. This information is indexed locally to serve your interactive face filter features.
              </li>
              <li>
                <strong>Profile & Account Details:</strong> Includes names, email addresses, phone numbers, and profile photos registered via Supabase Authentication.
              </li>
              <li>
                <strong>Transaction Records:</strong> Payment references, plan selections (Free, Basic, Premium, Photographer), and Razorpay transaction IDs. We do not store card credentials directly.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">3. How We Process Your Media</h2>
            <p>
              We prioritize the privacy of your media. Your photos are analyzed asynchronously using automated vision models. We do not sell or monetize your event photos. Media is only processed to organize the event timeline and provide guest filters. Guest uploads are subjected to automated resolution, exposure, and face-landmark filtering.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">4. Sharing and Security</h2>
            <p>
              By default, your gallery is private and accessible only via its randomized cryptographic slug URL. We do not share your private gallery links publicly unless you or your photographer choose to share them. All file transfers to AWS S3 storage are encrypted using secure sockets (HTTPS), and database tables are protected with strict PostgreSQL Row Level Security (RLS) policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">5. Data Retention & Deletion</h2>
            <p>
              Free galleries are retained for 7 days post-event, while Premium and Photographer tier galleries have lifetime storage as per our terms. You may request the absolute deletion of your account, event galleries, face clusters, and S3-hosted photos at any time by contacting our support team at <a href="mailto:support@memorylane.in" className="underline hover:text-zinc-900">support@memorylane.in</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">6. Third-Party Integrations</h2>
            <p>
              MemoryLane integrates with the following trusted processors:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Supabase:</strong> For user authentication database, metadata storage, and token issuance.</li>
              <li><strong>AWS S3:</strong> For secure cloud hosting of high-resolution source images and thumbnail face crops.</li>
              <li><strong>Google Gemini / AI Studio:</strong> For caption drafts and scene categorization (data is not used for base LLM training).</li>
              <li><strong>Razorpay:</strong> Secure payment processing.</li>
              <li><strong>Twilio & Resend:</strong> For delivery of WhatsApp status alerts and gallery confirmation emails.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">7. Contact Information</h2>
            <p>
              For legal inquiries, privacy concerns, or data erasure requests, please contact our compliance desk at <a href="mailto:privacy@memorylane.in" className="underline hover:text-zinc-900">privacy@memorylane.in</a> or visit our Contact Us page.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
