"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Link2, MessageCircle, ArrowRight, Check } from "lucide-react"

interface ShareActionsProps {
  token: string;
}

export default function ShareActions({ token }: ShareActionsProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${token}` : ""

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const whatsappUrl = `https://wa.me/?text=Check%20out%20my%20MemoryLane%20photo%20book!%20${encodeURIComponent(shareUrl)}`

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] flex items-center justify-center py-24 px-6 relative overflow-hidden select-none">
      {/* Decorative gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgba(201,169,110,0.08),rgba(255,255,255,0))]" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.0, ease: "easeOut" }}
        className="w-full max-w-xl text-center space-y-12 z-10"
      >
        <div className="space-y-4">
          <h2 className="text-[#faf9f7] font-serif text-3xl md:text-5xl font-black tracking-tightest leading-none">
            A MemoryLane Memory
          </h2>
          <p className="text-xs md:text-sm font-light text-[#a89f94] max-w-md mx-auto leading-relaxed">
            Every photo book tells a unique story, compiled by AI and preserved forever in the cloud.
          </p>
        </div>

        {/* Share buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 bg-[#121217] border border-zinc-800 text-[#faf9f7] hover:border-zinc-500 font-bold font-mono text-[10px] uppercase tracking-wider py-4.5 px-6 rounded-full shadow-lg transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#c9a96e]" />
                <span>Copied Link</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-[#c9a96e]" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 bg-[#121217] border border-[#c9a96e]/30 text-[#c9a96e] hover:border-[#c9a96e] font-bold font-mono text-[10px] uppercase tracking-wider py-4.5 px-6 rounded-full shadow-lg transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>Share on WhatsApp</span>
          </a>
        </div>

        {/* Viral Acquisition Loop block */}
        <div className="bg-[#121217] border border-zinc-900 rounded-3xl p-8 space-y-6 shadow-premium max-w-md mx-auto">
          <p className="text-[10px] text-[#faf9f7] font-bold tracking-widest uppercase font-mono">
            Want to preserve your memories too?
          </p>
          <p className="text-[11px] text-[#a89f94] font-light leading-relaxed">
            Upload your wedding, travel, or baby photos. Our AI will curate them instantly into a stunning cinematic experience.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[#faf9f7] text-[#0a0a0f] hover:bg-[#c9a96e] font-bold font-mono text-[10px] uppercase tracking-widest py-4 px-6 rounded-full shadow-md w-full transition-all group"
          >
            <span>Create Your MemoryLane</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </motion.div>
    </div>
  )
}
