"use client"

import React, { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

// Register GSAP ScrollTrigger safely on client
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

interface PhotoCardData {
  url: string
  caption: string
  leftClass: string
  topClass: string
  rotation: number
}

const WALL_PHOTOS: PhotoCardData[] = [
  {
    url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=500",
    caption: "ROUTE 66 ROAD TRIP",
    leftClass: "left-[76%]",
    topClass: "top-[18%]",
    rotation: -6
  },
  {
    url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500",
    caption: "LIVE FESTIVAL BEATS",
    leftClass: "left-[58%]",
    topClass: "top-[32%]",
    rotation: 8
  },
  {
    url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=500",
    caption: "BIRTHDAY SPREAD",
    leftClass: "left-[40%]",
    topClass: "top-[12%]",
    rotation: -4
  },
  {
    url: "https://images.unsplash.com/photo-1505678261036-a3fcc5e884ee?auto=format&fit=crop&q=80&w=500",
    caption: "BABY'S FIRST STEPS",
    leftClass: "left-[22%]",
    topClass: "top-[34%]",
    rotation: 10
  },
  {
    url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&q=80&w=500",
    caption: "CELEBRATION MAGIC",
    leftClass: "left-[4%]",
    topClass: "top-[16%]",
    rotation: -8
  }
]

export default function CinematicPhotoStream() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [photos, setPhotos] = useState<PhotoCardData[]>([])

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data, error } = await supabase.from("featured_books")
          .select("*")
          .eq("active", true)
          .order("display_order")
        
        if (error) {
          console.warn("Could not load featured books from database. Using local presets.", error.message)
          setPhotos(WALL_PHOTOS)
          return
        }
        
        if (data && data.length > 0) {
          const mapped = data.map((item, idx) => {
            const leftClasses = ["left-[4%]", "left-[22%]", "left-[40%]", "left-[58%]", "left-[76%]"]
            const topClasses = ["top-[16%]", "top-[34%]", "top-[12%]", "top-[32%]", "top-[18%]"]
            const rotations = [-8, 10, -4, 8, -6]
            return {
              url: item.image_url,
              caption: item.caption || "MEMORIES",
              leftClass: leftClasses[idx % leftClasses.length],
              topClass: topClasses[idx % topClasses.length],
              rotation: rotations[idx % rotations.length]
            }
          })
          setPhotos(mapped)
        } else {
          setPhotos(WALL_PHOTOS)
        }
      } catch (err: any) {
        console.warn("Featured books fetch failed, using local presets.", err?.message || err)
        setPhotos(WALL_PHOTOS)
      }
    }
    fetchFeatured()
  }, [])

  useEffect(() => {
    if (photos.length === 0) return

    // Clear any potential leftover ScrollTriggers to prevent duplicates
    ScrollTrigger.getAll().forEach(t => {
      if (t.trigger === sectionRef.current) {
        t.kill()
      }
    })

    const ctx = gsap.context(() => {
      // Create horizontal assembly timeline triggered once when visible
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 45%",
          toggleActions: "play none none none",
          invalidateOnRefresh: true
        }
      })

      // Title fades in and sits backgrounded
      tl.fromTo(".gallery-bg-title", 
        { opacity: 0, scale: 0.95 },
        { opacity: 0.05, scale: 1, duration: 0.5, ease: "power1.out" }
      )

      // Photos fade and lift in sequentially and land with a smooth ease
      tl.to(".wall-photo-card",
        {
          y: 0,
          rotate: (i) => photos[i]?.rotation || 0,
          scale: 1,
          opacity: 1,
          filter: "blur(0px)",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
          stagger: 0.25,
          duration: 1.5,
          ease: "power4.out"
        },
        "-=0.2"
      )

      // Micro-snapping "sticking" flash effect as each card lands
      .fromTo(".card-tape",
        { opacity: 0, scaleY: 0.2 },
        { opacity: 1, scaleY: 1, stagger: 0.25, duration: 0.4, ease: "power2.out" },
        "<+=0.2"
      )

      // Footer callout fades up at the end of the scroll pin
      .fromTo(".gallery-footer-text",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        "+=0.2"
      )

    }, sectionRef)

    return () => ctx.revert()
  }, [photos])

  return (
    <section 
      ref={sectionRef} 
      className="min-h-[600px] md:min-h-[720px] w-full bg-[#faf9f6] relative flex flex-col justify-between py-12 px-6 md:px-12 select-none overflow-hidden border-y border-zinc-100"
    >
      {/* Dynamic Grid Background Accent */}
      <div className="absolute inset-0 dot-grid-light opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.01] to-transparent pointer-events-none" />

      {/* Massive Background Title */}
      <div className="gallery-bg-title absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <span className="text-[16vw] font-serif font-black tracking-widest text-zinc-900 uppercase opacity-0">
          Archive
        </span>
      </div>

      {/* Header Info */}
      <div className="w-full flex flex-col items-center text-center z-10">
        <span className="font-geist-mono text-[9px] md:text-[10px] text-zinc-400 uppercase tracking-widest block mb-2">
          Compilation Sequence
        </span>
        <h3 className="text-3xl md:text-5xl font-serif font-black tracking-tight text-zinc-850">
          The Gallery Wall
        </h3>
        <p className="font-geist-mono text-[9px] text-zinc-400 uppercase tracking-wider mt-1.5">
          Scroll down to watch photos fly and stick to the layout
        </p>
      </div>

      {/* Interactive Photo Wall Canvas */}
      <div className="relative flex-1 w-full max-w-6xl mx-auto overflow-visible z-10 flex items-center">
        {photos.map((photo, idx) => (
          <div
            key={idx}
            className={`wall-photo-card absolute w-32 h-40 sm:w-44 sm:h-56 md:w-52 md:h-66 bg-white p-2.5 pb-8 md:p-3.5 md:pb-12 border border-zinc-200/50 rounded-2xl cursor-pointer hover:scale-105 hover:rotate-0 hover:z-30 hover:shadow-2xl transition-all duration-300 ${photo.leftClass} ${photo.topClass}`}
            style={{ 
              transform: "translateY(60px) rotate(-15deg) scale(0.92)", 
              opacity: 0, 
              filter: "blur(8px)",
              transformOrigin: "center center" 
            }}
          >
            {/* Mounting Tape (Sticks dynamically) */}
            <div className="card-tape absolute top-[-9px] left-1/2 -translate-x-1/2 w-10 h-4 bg-zinc-200/40 border border-black/[0.04] shadow-sm backdrop-blur-[0.5px] rotate-[-2deg] origin-top opacity-0" />
            
            <div className="relative w-full h-full rounded-lg overflow-hidden border border-zinc-100">
              <Image 
                src={photo.url} 
                alt={photo.caption} 
                fill
                sizes="(max-width: 768px) 150px, 250px"
                className="object-cover" 
              />
            </div>
            
            <span className="absolute bottom-2 md:bottom-3 left-0 w-full text-center font-geist-mono text-[7px] md:text-[8.5px] text-zinc-400 uppercase tracking-wider font-semibold truncate px-2">
              {photo.caption}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Text Revealed on Scroll Completion */}
      <div className="gallery-footer-text w-full text-center z-10 opacity-0 pb-4">
        <span className="font-geist-mono text-[10px] text-zinc-500 uppercase tracking-widest block">
          Your timeline, compiled and bound in digital spreads.
        </span>
      </div>
    </section>
  )
}
