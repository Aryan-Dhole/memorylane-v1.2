/*
MemoryLane Create Flow (updated):

STEP 1: Event details (/create)
  → User enters event name, type, date, location

STEP 2: Choose tier (/create/plan)  
  → User picks Free / Basic / Premium / Photographer

STEP 3: Upload photos (/create/upload)
  → Photos upload directly to S3 via pre-signed URLs
  → Upload confirmation sent to backend
  → Free tier: skip to receipt, trigger pipeline
  → Paid tier: continue to checkout

STEP 4: Checkout (/create/checkout) [paid tiers only]
  → Show order summary
  → Razorpay payment
  → On success: trigger pipeline job, redirect to receipt

STEP 5: Receipt (/create/receipt)
  → "We're creating your gallery"
  → User can close tab — Supabase Realtime updates if they stay
  → If they stay and pipeline completes: auto-redirect to review

STEP 6: Review (/dashboard/gallery/[slug]/review) [async — user comes back]
  → User reviews AI-selected photos
  → Can remove photos, edit captions, add more photos
  → Clicks "Publish gallery"
  → OR: auto-publishes after 24 hours

STEP 7: Published (/e/[slug])
  → Gallery is live
  → Share link works for anyone
  → "Made with MemoryLane" footer visible to all viewers
*/

"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Sparkles, Heart, Compass, Smile, Flame, BookOpen, ArrowLeft } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

const BOOK_TYPES = [
  { id: "wedding", title: "Wedding Edition", desc: "Celebrate vows, rituals, and your main wedding events.", icon: Heart, count: "[01]" },
  { id: "baby", title: "Baby Album", desc: "Freeze early baby giggles, milestones, and growth steps.", icon: Smile, count: "[02]" },
  { id: "travel", title: "Travel Chronicles", desc: "Map travel expeditions, landscapes, and holiday bursts.", icon: Compass, count: "[03]" },
  { id: "festival", title: "Festival Joy", desc: "Capture Diwali, Holi, and cultural reunions.", icon: Flame, count: "[04]" },
  { id: "classic", title: "Classic Stories", desc: "General portfolios, family yearbooks, or portraits.", icon: BookOpen, count: "[05]" }
]

export default function BookTypeSelector() {
  const [backLink, setBackLink] = useState("/")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setBackLink("/dashboard")
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setBackLink(session ? "/dashboard" : "/")
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-40 px-6 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      
      {/* Dynamic Background Light Glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-zinc-200/20 blur-[150px] pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <Link href={backLink} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-16 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>{backLink === "/dashboard" ? "Back to Dashboard" : "Back to Home"}</span>
        </Link>
        
        <div className="mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-white shadow-sm text-[9px] font-bold uppercase tracking-widest text-zinc-450 font-geist-mono mb-6">
            <span>Step 01 / 03</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif font-black text-zinc-900 tracking-tightest leading-none mb-6">
            What story are <br />
            we telling?
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl leading-relaxed font-light">
            Pick a narrative theme. Our AI pipeline adjusts its chronological structuring, indexing, and Claude caption templates to align perfectly with the occasion.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {BOOK_TYPES.map((type, idx) => {
            const Icon = type.icon
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 25, delay: idx * 0.08 }}
              >
                <Link href={`/create/${type.id}`} className="block">
                  <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 flex items-center justify-between gap-6 cursor-pointer hover:border-zinc-400 shadow-premium transition-all duration-300 group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-[#fafafa] border border-zinc-200 flex items-center justify-center text-zinc-800 group-hover:scale-105 transition-transform duration-300">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider font-geist-mono text-zinc-800">{type.title}</h4>
                        <p className="text-zinc-400 text-xs leading-relaxed max-w-md font-light">{type.desc}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold font-geist-mono text-zinc-300 group-hover:text-zinc-800 transition-colors shrink-0">
                      {type.count}
                    </span>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
