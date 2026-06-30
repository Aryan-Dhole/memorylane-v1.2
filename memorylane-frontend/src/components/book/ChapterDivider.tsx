"use client"

import React from "react"
import { motion } from "framer-motion"

interface ChapterDividerProps {
  name: string
}

export default function ChapterDivider({ name }: ChapterDividerProps) {
  // Split name into letters for staggered animation
  const letters = Array.from(name)

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 }
    }
  }

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 150
      }
    },
    hidden: {
      opacity: 0,
      y: 30,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 150
      }
    }
  }

  return (
    <div className="w-full h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden select-none">
      {/* Decorative gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(201,169,110,0.07),rgba(255,255,255,0))]" />

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, margin: "-10%" }}
        className="flex flex-wrap items-center justify-center px-8 text-center max-w-4xl"
      >
        <span className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest font-mono block w-full mb-6">
          Next Chapter
        </span>
        {letters.map((char, index) => (
          <motion.span
            variants={child}
            key={index}
            className="text-4xl md:text-6xl font-serif font-black text-[#faf9f7] tracking-tightest mx-0.5"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.div>
    </div>
  )
}
