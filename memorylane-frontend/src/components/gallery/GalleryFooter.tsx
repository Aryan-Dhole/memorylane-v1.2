"use client"

import React, { useState } from "react"
import { Copy, Check, MessageSquare } from "lucide-react"

interface GalleryFooterProps {
  slug: string;
  eventName: string;
  studioName?: string;
  studioLogoUrl?: string;
}

export default function GalleryFooter({ slug, eventName, studioName, studioLogoUrl }: GalleryFooterProps) {
  const [copied, setCopied] = useState(false)
  const galleryUrl = typeof window !== "undefined" ? `${window.location.origin}/e/${slug}` : ""

  const handleCopyLink = () => {
    navigator.clipboard.writeText(galleryUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Check out the private shared photos from ${eventName} on MemoryLane! Browse individual moments and filter photos of yourself here: ${galleryUrl}`
  )}`

  return (
    <footer className="w-full bg-zinc-950 border-t border-zinc-900 py-16 px-6 md:px-12 select-none flex flex-col items-center gap-12 text-center text-zinc-400">
      {/* Dynamic Branding Header */}
      {studioName ? (
        <div className="flex flex-col items-center gap-4">
          {studioLogoUrl ? (
            <img 
              src={studioLogoUrl} 
              alt={studioName} 
              className="max-h-12 max-w-[200px] object-contain filter invert opacity-90"
            />
          ) : (
            <h3 className="text-xl font-serif text-[#c9a96e] font-black">{studioName}</h3>
          )}
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
            Delivered via MemoryLane AI
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-xl font-serif text-[#c9a96e] font-black">MemoryLane</h3>
          <p className="text-xs max-w-sm leading-relaxed text-zinc-500 font-light">
            This private interactive gallery was curated by MemoryLane's visual AI pipeline.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-[#faf9f7] text-zinc-950 text-xs font-bold font-mono uppercase tracking-widest py-4 px-8 rounded-full shadow-lg hover:bg-[#c9a96e] transition-all"
          >
            Create Your Own Gallery
          </a>
        </div>
      )}

      {/* Share Box Row */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Share Gallery Link:</span>
        <div className="flex items-center gap-3">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-900/40 text-zinc-300 font-mono text-[10px] font-bold uppercase tracking-widest px-5 py-3 rounded-full hover:border-[#c9a96e] hover:text-white transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp Share
          </a>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-900/40 text-zinc-300 font-mono text-[10px] font-bold uppercase tracking-widest px-5 py-3 rounded-full hover:border-[#c9a96e] hover:text-white transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied Link!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Gallery URL
              </>
            )}
          </button>
        </div>
      </div>

      {/* Credits block */}
      <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-650 border-t border-zinc-900 w-full pt-8 max-w-lg">
        © {new Date().getFullYear()} MemoryLane Inc. All rights reserved.
      </div>
    </footer>
  )
}
