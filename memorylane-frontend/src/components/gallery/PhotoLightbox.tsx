"use client"

import React, { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Download, Heart } from "lucide-react"
import PhotoUnavailable from "@/components/ui/PhotoUnavailable"

interface Photo {
  id: string;
  url: string | null;
  caption: string;
  dominant_emotion: string;
  reaction_counts: { heart: number; laugh: number; cry: number; wow: number };
}

interface PhotoLightboxProps {
  photos: Photo[];
  activeIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReact: (photoId: string, reactionType: string) => void;
}

export default function PhotoLightbox({
  photos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  onReact
}: PhotoLightboxProps) {
  const isOpen = activeIndex !== null
  const photo = activeIndex !== null ? photos[activeIndex] : null

  // Bind keyboard navigation keys
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onPrev()
      if (e.key === "ArrowRight") onNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, onPrev, onNext])

  if (!photo) return null

  // Trigger S3 presigned key download in browser
  const handleDownload = () => {
    if (!photo) return
    const a = document.createElement("a")
    a.href = photo.url
    a.download = `photo_${activeIndex}.jpg`
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between select-none"
        >
          {/* Top Panel Actions */}
          <div className="w-full flex justify-between items-center px-6 py-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <span className="text-zinc-500 font-mono text-xs">
              {activeIndex + 1} / {photos.length}
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={handleDownload}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors"
                title="Download full resolution photo"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Photo Slide Center Container */}
          <div className="flex-1 flex items-center justify-between px-4 md:px-12 relative">
            {/* Prev arrow */}
            <button
              onClick={onPrev}
              className="absolute left-6 z-10 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 text-white p-3 rounded-full hover:bg-zinc-850 hover:border-zinc-700 transition-all select-none"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Main Image */}
            <div className="w-full max-w-4xl mx-auto h-[65vh] md:h-[75vh] flex items-center justify-center relative bg-zinc-950 rounded-lg">
              {photo.url ? (
                <>
                  <motion.img
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    src={photo.url}
                    alt="Lightbox expanded event detail"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement?.querySelector('.photo-fallback')?.classList.remove('hidden')
                    }}
                  />
                  <div className="photo-fallback hidden absolute inset-0 w-full h-[65vh] md:h-[75vh]">
                    <PhotoUnavailable className="w-full h-full rounded-lg" />
                  </div>
                </>
              ) : (
                <PhotoUnavailable className="w-full h-full rounded-lg" />
              )}
            </div>

            {/* Next arrow */}
            <button
              onClick={onNext}
              className="absolute right-6 z-10 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 text-white p-3 rounded-full hover:bg-zinc-850 hover:border-zinc-700 transition-all select-none"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Panel Caption & Reactions */}
          <div className="w-full bg-gradient-to-t from-black/90 to-transparent p-6 text-center z-10 flex flex-col items-center gap-4">
            {photo.caption && (
              <p 
                className="text-lg md:text-xl font-serif italic text-zinc-200 max-w-3xl leading-relaxed"
                dangerouslySetInnerHTML={{ __html: `"${photo.caption}"` }}
              />
            )}

            {/* Reaction floating drawer */}
            <div className="flex items-center justify-center gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-full px-6 py-3 backdrop-blur-md shadow-lg">
              <button
                onClick={() => onReact(photo.id, "heart")}
                className="flex items-center gap-1.5 hover:scale-110 active:scale-95 transition-all text-sm font-mono"
              >
                <span>❤️</span>
                <span className="text-xs text-zinc-400 font-bold">{photo.reaction_counts.heart || 0}</span>
              </button>
              <button
                onClick={() => onReact(photo.id, "laugh")}
                className="flex items-center gap-1.5 hover:scale-110 active:scale-95 transition-all text-sm font-mono"
              >
                <span>😂</span>
                <span className="text-xs text-zinc-400 font-bold">{photo.reaction_counts.laugh || 0}</span>
              </button>
              <button
                onClick={() => onReact(photo.id, "cry")}
                className="flex items-center gap-1.5 hover:scale-110 active:scale-95 transition-all text-sm font-mono"
              >
                <span>😢</span>
                <span className="text-xs text-zinc-400 font-bold">{photo.reaction_counts.cry || 0}</span>
              </button>
              <button
                onClick={() => onReact(photo.id, "wow")}
                className="flex items-center gap-1.5 hover:scale-110 active:scale-95 transition-all text-sm font-mono"
              >
                <span>😮</span>
                <span className="text-xs text-zinc-400 font-bold">{photo.reaction_counts.wow || 0}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
