"use client"

import React from "react"
import { motion } from "framer-motion"
import Image from "next/image"

interface PhotoItem {
  url: string;
  caption: string;
}

interface PhotoSectionProps {
  layoutType: "single" | "double" | "portrait";
  photos: PhotoItem[];
}

export default function PhotoSection({ layoutType, photos }: PhotoSectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as const }
    }
  }

  const captionVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.4, duration: 0.8 }
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] flex items-center justify-center py-24 px-6 md:px-16 relative overflow-hidden select-none">
      {/* Subtle background ambient lighting glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.01),transparent)] pointer-events-none" />
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-15%" }}
        className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center z-10"
      >
        {layoutType === "single" && photos[0] && (
          <motion.div variants={itemVariants} className="w-full flex flex-col items-center gap-8">
            <div className="relative w-full aspect-[16/10] md:aspect-[21/10] rounded-3xl overflow-hidden border border-zinc-900/60 group shadow-premium-dark">
              <img
                src={photos[0].url}
                alt={photos[0].caption || "MemoryLane curated photo"}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-[1.03]"
              />
            </div>
            {photos[0].caption && (
              <motion.p variants={captionVariants} className="text-center font-serif text-sm md:text-base italic text-[#a89f94] max-w-2xl px-6 leading-relaxed">
                "{photos[0].caption}"
              </motion.p>
            )}
          </motion.div>
        )}

        {layoutType === "double" && photos.length >= 2 && (
          <div className="w-full grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            {photos.slice(0, 2).map((item, idx) => (
              <motion.div key={idx} variants={itemVariants} className="flex flex-col items-center gap-8">
                <div className="relative w-full aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden border border-zinc-900/60 group shadow-premium-dark">
                  <img
                    src={item.url}
                    alt={item.caption || "MemoryLane curated photo"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-[1.03]"
                  />
                </div>
                {item.caption && (
                  <motion.p variants={captionVariants} className="text-center font-serif text-xs md:text-sm italic text-[#a89f94] max-w-md px-6 leading-relaxed">
                    "{item.caption}"
                  </motion.p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {layoutType === "portrait" && photos[0] && (
          <motion.div variants={itemVariants} className="w-full flex flex-col items-center gap-8">
            <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden border border-zinc-900/60 group shadow-premium-dark">
              <img
                src={photos[0].url}
                alt={photos[0].caption || "MemoryLane curated photo"}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-[1.03]"
              />
            </div>
            {photos[0].caption && (
              <motion.p variants={captionVariants} className="text-center font-serif text-sm md:text-base italic text-[#a89f94] max-w-md px-6 leading-relaxed">
                "{photos[0].caption}"
              </motion.p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
