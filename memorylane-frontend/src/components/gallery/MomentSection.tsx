"use client"

import React from "react"
import { motion } from "framer-motion"
import { Heart, Laugh, Smile, MessageSquare, ExternalLink } from "lucide-react"

interface Photo {
  id: string;
  url: string;
  thumb_url: string;
  caption: string;
  face_cluster_ids: number[];
  dominant_emotion: string;
  reaction_counts: { heart: number; laugh: number; cry: number; wow: number };
}

interface MomentSectionProps {
  momentId: string;
  momentName: string;
  photos: Photo[];
  activeCluster: number | null;
  onOpenLightbox: (photoIndex: number) => void;
  onReact: (photoId: string, reactionType: string) => void;
}

const MOMENT_LAYOUTS: Record<string, "masonry" | "editorial" | "grid"> = {
  "Getting Ready": "editorial",
  "The Ceremony": "editorial",
  "Just Married": "editorial",
  "Family & Friends": "grid",
  "The Celebration": "masonry",
  "Candid Magic": "masonry",
  "The Details": "grid",
}

export default function MomentSection({
  momentId,
  momentName,
  photos,
  activeCluster,
  onOpenLightbox,
  onReact
}: MomentSectionProps) {
  // If face cluster filter is active, some photos might be hidden or dimmed.
  // The filter is purely client side. Dim photos that don't match the cluster.
  const visiblePhotos = photos.map((p) => {
    const isMatched = activeCluster === null || p.face_cluster_ids.includes(activeCluster)
    return { ...p, dimmed: !isMatched }
  })

  // Skip rendering this section if no photos exist
  if (photos.length === 0) return null

  // Determine layout type
  const layout = MOMENT_LAYOUTS[momentName] || "masonry"

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
    }
  }

  // Render photo card
  const renderPhotoCard = (photo: Photo & { dimmed: boolean }, index: number, layoutAspect: string = "aspect-[3/2]") => {
    const globalPhotoIndex = photos.findIndex(p => p.id === photo.id)
    
    return (
      <motion.div
        variants={cardVariants}
        key={photo.id}
        className={`group relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 transition-all duration-500 cursor-pointer ${
          photo.dimmed ? "opacity-20 pointer-events-none scale-95" : "opacity-100 hover:scale-[1.01]"
        }`}
        onClick={() => onOpenLightbox(globalPhotoIndex)}
      >
        <div className={`relative w-full ${layoutAspect} overflow-hidden`}>
          <img
            src={photo.thumb_url || photo.url}
            alt={photo.caption || "MemoryLane event photo"}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-105"
          />
          {/* Cover gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          {/* Reaction counts floating pill */}
          {Object.values(photo.reaction_counts).reduce((a, b) => a + b, 0) > 0 && (
            <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/80 px-2 py-1 rounded-full text-[9px] font-mono text-zinc-300 flex items-center gap-1">
              <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
              <span>{Object.values(photo.reaction_counts).reduce((a, b) => a + b, 0)}</span>
            </div>
          )}
        </div>

        {/* Caption & Quick Reaction Row inside Hover info (on desktop) and always on mobile */}
        <div className="p-4 bg-zinc-950/95 md:absolute md:bottom-0 md:left-0 md:right-0 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-300 z-10">
          {photo.caption && (
            <p 
              className="text-[13px] font-serif italic text-zinc-300 leading-relaxed mb-3 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: `"${photo.caption}"` }}
            />
          )}
          
          {/* Inline reactions tray */}
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-900" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => onReact(photo.id, "heart")} 
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-rose-400 transition-colors"
            >
              <span>❤️</span>
              <span>{photo.reaction_counts.heart || 0}</span>
            </button>
            <button 
              onClick={() => onReact(photo.id, "laugh")} 
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-yellow-400 transition-colors"
            >
              <span>😂</span>
              <span>{photo.reaction_counts.laugh || 0}</span>
            </button>
            <button 
              onClick={() => onReact(photo.id, "cry")} 
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-blue-400 transition-colors"
            >
              <span>😢</span>
              <span>{photo.reaction_counts.cry || 0}</span>
            </button>
            <button 
              onClick={() => onReact(photo.id, "wow")} 
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-purple-400 transition-colors"
            >
              <span>😮</span>
              <span>{photo.reaction_counts.wow || 0}</span>
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div id={momentId} className="w-full bg-[#0a0a0f] py-16 px-6 md:px-12 select-none border-b border-zinc-900 last:border-b-0">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Moment Title */}
        <div className="flex items-center gap-6">
          <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white whitespace-nowrap">{momentName}</h2>
          <div className="w-full h-[1px] bg-zinc-900" />
        </div>

        {/* Layout Render branch */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
        >
          {layout === "grid" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {visiblePhotos.map((photo, idx) => renderPhotoCard(photo, idx, "aspect-square"))}
            </div>
          )}

          {layout === "editorial" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column - Large Hero */}
              {visiblePhotos[0] && (
                <div className="md:col-span-2">
                  {renderPhotoCard(visiblePhotos[0], 0, "aspect-[16/10] md:aspect-[4/3]")}
                </div>
              )}
              
              {/* Right Column - Stack of 2 smaller cards */}
              <div className="flex flex-col gap-6">
                {visiblePhotos[1] && renderPhotoCard(visiblePhotos[1], 1, "aspect-[16/10] md:aspect-square")}
                {visiblePhotos[2] && renderPhotoCard(visiblePhotos[2], 2, "aspect-[16/10] md:aspect-square")}
              </div>
              
              {/* Remaining grid if photos count > 3 */}
              {visiblePhotos.length > 3 && (
                <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
                  {visiblePhotos.slice(3).map((photo, idx) => renderPhotoCard(photo, idx + 3, "aspect-square"))}
                </div>
              )}
            </div>
          )}

          {layout === "masonry" && (
            <div className="columns-1 sm:columns-2 md:columns-3 gap-6 space-y-6">
              {visiblePhotos.map((photo, idx) => {
                // Alternating aspect ratio for masonry feel
                const aspect = idx % 3 === 0 ? "aspect-[3/4]" : idx % 2 === 0 ? "aspect-[4/5]" : "aspect-[3/2]"
                return (
                  <div key={photo.id} className="break-inside-avoid mb-6">
                    {renderPhotoCard(photo, idx, aspect)}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
