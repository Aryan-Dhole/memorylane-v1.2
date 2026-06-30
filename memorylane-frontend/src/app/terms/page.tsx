"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
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
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none mb-4 text-zinc-900">Terms of Service</h1>
          <p className="text-xs text-zinc-400 font-geist-mono uppercase tracking-wider">Last Updated: July 1, 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none text-zinc-650 text-sm font-light leading-relaxed space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the MemoryLane platform (including the website, API, and associated background curation pipeline), you agree to be bound by these Terms of Service. If you do not agree, you must immediately cease using the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">2. Description of Service</h2>
            <p>
              MemoryLane provides an AI-driven digital event gallery orchestration service. Photographers and event hosts can select files, initialize uploads, trigger visual AI processing (emotion, quality scoring, timeline sorting, and image captioning), and publish interactive public event galleries with facial filter support.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">3. User Obligations and Content Rights</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Ownership:</strong> You retain full copyright ownership of all images, photos, and assets uploaded to your gallery. We do not claim ownership of your content.
              </li>
              <li>
                <strong>Permissions:</strong> You warrant that you have obtained all necessary permissions, consent forms, and privacy waivers from event guests, couples, or attendees before uploading their photos or enabling guest dropzones.
              </li>
              <li>
                <strong>Prohibited Content:</strong> You agree not to upload any material that is obscene, defamatory, illegal, or violates intellectual property rights. We reserve the right to suspend any gallery violating these standards.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">4. Billing, Pricing Tiers, and Purchases</h2>
            <p>
              We offer Free, Basic, Premium, and Photographer subscription tiers.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Free Tier:</strong> Limited to 50 uploads and 7 days of gallery availability.</li>
              <li><strong>Paid Tiers:</strong> Retain unlimited time duration access, higher upload counts, and guest upload management. Fees are charged in Indian Rupees (INR) via Razorpay.</li>
              <li>All payments are processed securely. Subscriptions and pricing metrics are detailed on our landing page.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">5. Limitation of Liability</h2>
            <p>
              MemoryLane, its developers, and partners shall not be liable for any indirect, incidental, or consequential damages resulting from data loss, server downtime, S3 storage outages, or processing delays by third-party AI APIs (including Google Gemini AI Studio or Anthropic).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">6. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws of India. Any legal disputes arising out of the use of this service shall be subject to the exclusive jurisdiction of the courts located in Mumbai, Maharashtra, India.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
