"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function RefundsPage() {
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
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none mb-4 text-zinc-900">Refunds & Cancellation</h1>
          <p className="text-xs text-zinc-400 font-geist-mono uppercase tracking-wider">Last Updated: July 1, 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none text-zinc-650 text-sm font-light leading-relaxed space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">1. Overview</h2>
            <p>
              At MemoryLane, customer satisfaction is our top priority. Since our gallery curation service is a digital, AI-driven process that utilizes compute credits and server power immediately upon execution, refunds are governed by the guidelines below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">2. Cancellation Policy</h2>
            <p>
              You may choose not to publish your event gallery or delete your event database entries at any point. However, because backend AI curation starts as soon as files are uploaded and checkout is completed, order cancellations are not possible once the AI pipeline has processed the images (Step 5: Receipt / Curation Initiated).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">3. Refund Terms</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>AI Curation Failures:</strong> In the rare event that our servers experience a critical crash or backend error that completely prevents the generation of your gallery or face filters, we will issue a 100% refund.
              </li>
              <li>
                <strong>Dissatisfaction:</strong> If you are unhappy with the quality of the automated captions or face crops, please contact us. While we do not issue automatic refunds for subjective styling results, we will manually review your case and may offer credits, a rerun of the AI pipeline with adjusted parameters, or a partial refund.
              </li>
              <li>
                <strong>Free Trials:</strong> We encourage all users to experiment with the Free tier (50 images) before subscribing to Basic, Premium, or Photographer plans. Refunds are not issued for lack of compatibility that could have been tested during the free execution.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">4. Refund Processing Time</h2>
            <p>
              Approved refunds will be processed back to the original method of payment via Razorpay. It typically takes <strong>5 to 7 working days</strong> for the refund amount to reflect in your bank account, credit card, or UPI wallet, as per standard banking schedules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">5. How to Request a Refund</h2>
            <p>
              To request a refund, please send an email to <a href="mailto:refunds@memorylane.in" className="underline hover:text-zinc-900">refunds@memorylane.in</a> with your:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Order Tracker ID (e.g., `ML-XXXX`)</li>
              <li>Registered email address</li>
              <li>Reason for the refund request</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
