"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, Users, Lock, X, Sparkles, User } from "lucide-react"

interface FaceCluster {
  cluster_index: number;
  face_crop_url: string;
  photo_count: number;
}

interface FaceFilterStripProps {
  faceClusters: FaceCluster[];
  activeCluster: number | null;
  onSelectCluster: (clusterIndex: number | null) => void;
  onDownloadFiltered: () => void;
  filteredCount: number;
  isFiltered: boolean;
  tier?: string;
}

export default function FaceFilterStrip({
  faceClusters,
  activeCluster,
  onSelectCluster,
  onDownloadFiltered,
  filteredCount,
  isFiltered,
  tier = "free"
}: FaceFilterStripProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const isFreeTier = tier.toLowerCase() === "free"

  return (
    <div className="w-full bg-[#0a0a0f] border-y border-zinc-900 sticky top-0 z-40 backdrop-blur-md bg-opacity-90 py-4 px-6 md:px-12 select-none">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Horizontal flex strip of faces */}
        <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold whitespace-nowrap">Show my photos:</span>
          
          {/* All Photos pill */}
          <button 
            onClick={() => onSelectCluster(null)}
            className={`flex flex-col items-center gap-1.5 focus:outline-none shrink-0`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 ${
              activeCluster === null 
                ? "bg-[#c9a96e] border-[#c9a96e] text-zinc-950 scale-105" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">All</span>
          </button>

          {/* Cluster faces list */}
          {faceClusters.map((cluster) => {
            const isActive = activeCluster === cluster.cluster_index
            const cropUrl = cluster.face_crop_url

            return (
              <button
                key={cluster.cluster_index}
                onClick={() => {
                  if (isFreeTier) {
                    setShowUpgradeModal(true)
                  } else {
                    onSelectCluster(isActive ? null : cluster.cluster_index)
                  }
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0 group relative"
              >
                <div className={`w-14 h-14 rounded-full overflow-hidden border transition-all duration-300 relative ${
                  isActive && !isFreeTier
                    ? "border-[#c9a96e] ring-2 ring-[#c9a96e] scale-105" 
                    : "border-zinc-800 group-hover:border-zinc-700"
                }`}>
                  {cropUrl ? (
                    <img 
                      src={cropUrl} 
                      alt={`Face ${cluster.cluster_index}`}
                      className={`w-full h-full object-cover transition-all ${
                        isFreeTier ? "grayscale opacity-40 blur-[1px]" : ""
                      }`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.face-fallback')?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="face-fallback hidden absolute inset-0 bg-zinc-900 flex items-center justify-center text-zinc-550">
                    <User className="w-5 h-5" />
                  </div>
                  
                  {/* Lock badge icon overlay for Free tier */}
                  {isFreeTier ? (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white/95">
                      <Lock className="w-3.5 h-3.5 drop-shadow-md text-[#c9a96e]" />
                    </div>
                  ) : (
                    <div className="absolute bottom-0 right-0 bg-zinc-950/95 border border-zinc-800 text-[8px] font-mono text-zinc-300 font-bold px-1 rounded-sm">
                      {cluster.photo_count}
                    </div>
                  )}
                </div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase font-bold flex items-center gap-1">
                  Face {cluster.cluster_index + 1}
                  {isFreeTier && <Lock className="w-2 h-2 text-zinc-650" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Filter status and Download filter group button */}
        {isFiltered && !isFreeTier && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 w-full md:w-auto justify-between border-t border-zinc-900 pt-3 md:border-t-0 md:pt-0 shrink-0"
          >
            <div className="text-left font-mono">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Photos containing person:</p>
              <p className="text-sm text-[#c9a96e] font-black">{filteredCount} matches found</p>
            </div>
            
            <button
              onClick={onDownloadFiltered}
              className="inline-flex items-center gap-2 bg-[#c9a96e] text-zinc-950 text-[10px] font-bold font-mono uppercase tracking-wider py-3 px-5 rounded-full hover:bg-[#b0925c] shadow-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download My Photos
            </button>
          </motion.div>
        )}
      </div>

      {/* Modern Premium Upgrade Dialog Overlay */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop click dismisses */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpgradeModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-[#0e0e13] border border-zinc-800 rounded-[32px] p-8 max-w-md w-full relative text-center flex flex-col items-center gap-6 shadow-2xl z-10 font-sans"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Glowing Lock Graphic */}
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#c9a96e] relative">
                <div className="absolute inset-0 rounded-full bg-[#c9a96e]/10 animate-ping pointer-events-none" />
                <Lock className="w-6 h-6" />
              </div>

              {/* Title & Badge */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#c9a96e]/30 bg-[#c9a96e]/10 text-[9px] font-bold uppercase tracking-wider text-[#c9a96e] font-mono">
                  <Sparkles className="w-3 h-3" />
                  <span>Premium Feature</span>
                </div>
                <h3 className="text-2xl font-serif font-black text-white mt-2">Unlock AI Face Grouping</h3>
              </div>

              {/* Description body */}
              <p className="text-zinc-400 text-xs leading-relaxed font-light">
                Our advanced computer vision models index facial landmarks to compile personal matches instantly. 
                <br /><br />
                To activate guest face-search, filters, and batch photo downloads, upgrade this gallery from your creator dashboard or invite guests to purchase a digital package upgrade.
              </p>

              {/* CTA options */}
              <div className="flex flex-col gap-3 w-full mt-2">
                <button 
                  onClick={() => setShowUpgradeModal(false)}
                  className="bg-[#c9a96e] hover:bg-[#b0925c] text-zinc-950 font-mono text-[10px] font-bold uppercase tracking-widest py-4 px-6 rounded-full shadow-lg transition-all"
                >
                  View Gallery Upgrades
                </button>
                <button 
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 font-mono text-[10px] font-bold uppercase tracking-widest py-2 transition-all"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
