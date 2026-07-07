"use client"

import React, { useEffect } from "react"
import Lenis from "lenis"
import BookCover from "./BookCover"
import ChapterDivider from "./ChapterDivider"
import PhotoSection from "./PhotoSection"
import ShareActions from "./ShareActions"
import { Sparkles } from "lucide-react"

interface PhotoItem {
  url: string;
  caption: string;
  chapter: number;
  chapter_name: string;
}

interface ChapterItem {
  index: number;
  name: string;
  photo_count: number;
}

interface CinematicViewerProps {
  title: string;
  eventType: string;
  createdAt: string;
  photos: PhotoItem[];
  chapters: ChapterItem[];
  token: string;
  isTrial?: boolean;
  trialId?: string;
}

export default function CinematicViewer({
  title,
  eventType,
  createdAt,
  photos,
  chapters,
  token,
  isTrial = false,
  trialId = ""
}: CinematicViewerProps) {
  
  // 1. Initialize Lenis Smooth Scroll on mount
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // 2. Helper to partition photos into layout sections dynamically
  const getLayoutSections = (chapPhotos: PhotoItem[]) => {
    const sections = []
    let i = 0
    let layoutIndex = 0

    while (i < chapPhotos.length) {
      const remaining = chapPhotos.length - i
      const pattern = layoutIndex % 3

      if (pattern === 1 && remaining >= 2) {
        // Double layout
        sections.push({
          type: "double" as const,
          items: [chapPhotos[i], chapPhotos[i + 1]]
        })
        i += 2
      } else if (pattern === 2) {
        // Portrait centered layout
        sections.push({
          type: "portrait" as const,
          items: [chapPhotos[i]]
        })
        i += 1
      } else {
        // Single landscape layout
        sections.push({
          type: "single" as const,
          items: [chapPhotos[i]]
        })
        i += 1
      }
      layoutIndex++
    }
    return sections
  }

  const coverUrl = photos[0]?.url || ""

  return (
    <div className="w-full bg-[#0a0a0f] text-[#faf9f7] font-sans overflow-x-hidden min-h-screen relative selection:bg-[#c9a96e] selection:text-[#0a0a0f]">
      
      {/* Repeating diagonal watermark overlay for Free Trial */}
      {isTrial && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.06] flex flex-wrap gap-24 p-10 justify-center items-center text-white select-none">
          {Array(30).fill("MEMORYLANE TRIAL").map((text, idx) => (
            <span key={idx} className="text-xs font-bold tracking-widest font-geist-mono uppercase transform -rotate-30 select-none">
              {text}
            </span>
          ))}
        </div>
      )}

      {/* 1. Immersive Cover Page */}
      <BookCover 
        title={title} 
        eventType={eventType} 
        coverUrl={coverUrl} 
        date={createdAt} 
      />

      {/* 2. Chapters & Photos Grid */}
      {chapters.map((chap) => {
        const chapPhotos = photos.filter((p) => p.chapter === chap.index)
        if (chapPhotos.length === 0) return null
        
        const sections = getLayoutSections(chapPhotos)
        
        return (
          <React.Fragment key={chap.index}>
            {/* Chapter Screen Transition */}
            <ChapterDivider name={chap.name} />
            
            {/* Associated Photos Sections */}
            {sections.map((sec, secIdx) => {
              // Apply blur over the bottom 40% of the photos (e.g. photos 4 and 5 in the trial stream)
              const applyBlur = isTrial && secIdx >= 1
              
              return (
                <div key={`${chap.index}-${secIdx}`} className={applyBlur ? "blur-md pointer-events-none opacity-40 select-none transition-all duration-700" : ""}>
                  <PhotoSection
                    layoutType={sec.type}
                    photos={sec.items}
                  />
                </div>
              )
            })}
          </React.Fragment>
        )
      })}

      {/* 3. Social Share or Free Trial Conversion CTA */}
      {isTrial ? (
        <div className="relative w-full py-24 flex flex-col items-center justify-center bg-[#0a0a0f]/90 border-t border-white/5 z-30 px-6">
          <div className="max-w-md w-full bg-[#13131a] border border-white/5 p-8 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500" />
            <Sparkles className="w-8 h-8 text-[#c9a96e] mx-auto animate-pulse" />
            
            <div className="space-y-2">
              <h3 className="text-xl font-serif font-black text-white tracking-tight">Curation Complete</h3>
              <p className="text-zinc-400 text-xs font-light leading-relaxed">
                You uploaded 10 photos. We selected the best 5 for your preview.
              </p>
              <p className="text-zinc-500 text-[10px] leading-relaxed max-w-xs mx-auto font-light">
                Your full book would include all your remaining photos mapped into curated narrative chapters and vision captions.
              </p>
            </div>
            
            <div className="pt-2 space-y-3">
              <button 
                onClick={() => window.location.href = `/create?from_trial=${trialId}`}
                className="w-full bg-[#faf9f7] hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wider font-geist-mono h-12 rounded-xl transition-all shadow-md"
              >
                Create my full book — ₹599
              </button>
              <button 
                onClick={() => window.location.href = `/login?next=/create?from_trial=${trialId}`}
                className="w-full bg-transparent border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider font-geist-mono h-12 rounded-xl transition-all"
              >
                Sign up to save this preview
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ShareActions token={token} />
      )}
      
    </div>
  )
}
