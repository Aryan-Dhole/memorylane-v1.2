"use client"

import React from "react"
import { motion } from "framer-motion"
import { ChevronDown, Heart, Laugh, Smile, Sparkles } from "lucide-react"

interface GalleryCoverProps {
  eventName: string;
  eventType: string;
  eventDate: string;
  eventLocation: string;
  coverPhotoUrl: string;
  totalReactions: number;
}

export default function GalleryCover({
  eventName,
  eventType,
  eventDate,
  eventLocation,
  coverPhotoUrl,
  totalReactions
}: GalleryCoverProps) {
  const hasCover = !!coverPhotoUrl

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-zinc-950 flex flex-col justify-between items-center text-center px-6 py-12">
      {/* Background Image Parallax layer */}
      {hasCover ? (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-65 scale-[1.02] transition-transform duration-1000"
          style={{ backgroundImage: `url(${coverPhotoUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 opacity-60" />
      )}
      
      {/* Luxury Vignette and Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-transparent to-zinc-950 pointer-events-none" />
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Header Accent */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="z-10 mt-6 flex items-center gap-2 border border-white/20 bg-zinc-900/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#c9a96e]" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 font-bold">{eventType} Gallery</span>
      </motion.div>

      {/* Center Event Metadata */}
      <div className="z-10 flex flex-col items-center max-w-4xl my-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-6xl md:text-7xl font-serif font-black tracking-tightest leading-tight text-white drop-shadow-lg"
        >
          {eventName}
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.2 }}
          className="mt-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-zinc-200 text-xs sm:text-sm uppercase tracking-widest font-mono font-bold"
        >
          {eventDate && <span>{new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          {eventDate && eventLocation && <span className="hidden sm:inline text-zinc-500">•</span>}
          {eventLocation && <span>{eventLocation}</span>}
        </motion.div>

        {totalReactions > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-8 flex items-center gap-2 border border-[#c9a96e]/30 bg-zinc-900/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg"
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
            <span className="text-[11px] font-mono text-zinc-300 font-bold uppercase tracking-wider">{totalReactions} Reactions across gallery</span>
          </motion.div>
        )}
      </div>

      {/* Footer Scroll hint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="z-10 flex flex-col items-center gap-2 text-zinc-400 font-mono text-[9px] uppercase tracking-widest"
      >
        <span>Scroll to Explore</span>
        <motion.div 
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        </motion.div>
      </motion.div>
    </div>
  )
}
