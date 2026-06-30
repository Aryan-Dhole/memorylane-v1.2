"use client"

import React from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

interface BookCoverProps {
  title: string
  eventType: string
  coverUrl: string
  date: string
}

export default function BookCover({ title, eventType, coverUrl, date }: BookCoverProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden flex items-center justify-center bg-[#0a0a0f]">
      {/* Full-bleed cover photo */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60" 
        style={{ backgroundImage: `url(${coverUrl})` }}
      />
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/50 to-transparent" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mt-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="space-y-6"
        >
          <span className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest font-mono block">
            MemoryLane • {eventType} Edition
          </span>
          <h1 className="text-5xl md:text-7xl font-serif font-black text-[#faf9f7] tracking-tightest leading-none drop-shadow-md">
            {title}
          </h1>
          <p className="text-xs font-light text-[#a89f94] font-mono uppercase tracking-widest">
            {date ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
          </p>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#a89f94]"
        >
          <span className="text-[9px] font-bold uppercase tracking-widest font-mono">Scroll to Explore</span>
          <ChevronDown className="w-4 h-4 animate-bounce text-[#c9a96e]" />
        </motion.div>
      </div>
    </div>
  )
}
