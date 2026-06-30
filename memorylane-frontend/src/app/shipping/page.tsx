"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ShippingPage() {
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
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none mb-4 text-zinc-900">Shipping & Delivery</h1>
          <p className="text-xs text-zinc-400 font-geist-mono uppercase tracking-wider">Last Updated: July 1, 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none text-zinc-650 text-sm font-light leading-relaxed space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">1. Digital Delivery Only</h2>
            <p>
              MemoryLane is a 100% digital private event gallery curation service. We do not manufacture, package, or dispatch any physical albums, photo books, prints, or merchandise. Consequently, no physical shipping fees or delivery timelines apply to our plans.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">2. Delivery Method and Timeline</h2>
            <p>
              Once photo upload and checkout confirmation complete, the visual AI pipeline executes automatically.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Curation Time:</strong> The processing time depends on the size of your upload batch. AI clustering, scoring, face extraction, and captioning typically finish within <strong>10 to 20 minutes</strong>.
              </li>
              <li>
                <strong>Notification:</strong> As soon as the private gallery goes live, a unique access link is dispatched immediately to your registered account email and via WhatsApp message (if phone number updates are enabled).
              </li>
              <li>
                <strong>Access Link:</strong> You can also access, share, download, and configure your active galleries directly from your personal <Link href="/dashboard" className="underline hover:text-zinc-900 font-medium">MemoryLane Dashboard</Link> at any time.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-serif font-black text-zinc-900">3. Delivery Failures and Support</h2>
            <p>
              If your curation process takes longer than 30 minutes, or if you do not receive your email/WhatsApp confirmation, it may be due to temporary network load or API bottlenecks. Please check your spam folder or contact our support engineering desk at <a href="mailto:support@memorylane.in" className="underline hover:text-zinc-900">support@memorylane.in</a>, and we will manually check your batch status and deliver the gallery link immediately.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
