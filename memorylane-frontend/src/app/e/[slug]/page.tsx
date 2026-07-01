"use client"

import React, { useState, useEffect, use } from "react"
import GalleryCover from "@/components/gallery/GalleryCover"
import FaceFilterStrip from "@/components/gallery/FaceFilterStrip"
import MomentNav from "@/components/gallery/MomentNav"
import MomentSection from "@/components/gallery/MomentSection"
import GuestUploadSection from "@/components/gallery/GuestUploadSection"
import GalleryFooter from "@/components/gallery/GalleryFooter"
import PhotoLightbox from "@/components/gallery/PhotoLightbox"
import { Loader2 } from "lucide-react"

interface Photo {
  id: string;
  url: string;
  thumb_url: string;
  caption: string;
  face_cluster_ids: number[];
  dominant_emotion: string;
  reaction_counts: { heart: number; laugh: number; cry: number; wow: number };
}

interface Moment {
  id: string;
  name: string;
  display_order: number;
  cover_photo_url: string;
  photos: Photo[];
}

interface FaceCluster {
  cluster_index: number;
  face_crop_url: string;
  photo_count: number;
}

interface GalleryData {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  event_location: string;
  cover_photo_url: string;
  caption_style: string;
  moments: Moment[];
  face_clusters: FaceCluster[];
  allow_guest_uploads: boolean;
  allow_reactions: boolean;
  total_photos: number;
  view_count: number;
  tier?: string;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function GalleryPage({ params }: PageProps) {
  const { slug } = use(params)
  
  const [gallery, setGallery] = useState<GalleryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [isReviewPending, setIsReviewPending] = useState(false)
  
  // Filtering state
  const [activeCluster, setActiveCluster] = useState<number | null>(null)
  
  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  
  // Active moment tracking
  const [activeMoment, setActiveMoment] = useState<string | null>(null)

  const fetchGallery = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${apiBase}/gallery/${slug}`)
      if (!res.ok) {
        if (res.status === 403) {
          setIsReviewPending(true)
          throw new Error("This gallery isn't live yet. The creator is putting the finishing touches on it. Check back soon.")
        }
        if (res.status === 404) {
          throw new Error("This event gallery could not be found.")
        }
        throw new Error("Failed to load gallery details.")
      }
      const data = await res.json()
      setGallery(data)
      if (data.moments && data.moments.length > 0) {
        setActiveMoment(data.moments[0].id)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Something went wrong loading your gallery.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGallery()
  }, [slug])

  // Count total reactions across all photos
  const totalReactions = gallery?.moments.reduce((acc, m) => {
    return acc + m.photos.reduce((pAcc, p) => {
      return pAcc + Object.values(p.reaction_counts).reduce((a, b) => a + b, 0)
    }, 0)
  }, 0) || 0

  // Quick reaction handler
  const handleReact = async (photoId: string, reactionType: string) => {
    if (!gallery) return

    // Limit to single reaction per photo per type per user session
    const reactedKey = `reacted_${photoId}_${reactionType}`
    if (localStorage.getItem(reactedKey)) {
      return
    }
    localStorage.setItem(reactedKey, "true")
    
    // Generate/retrieve unique session ID
    let guestSession = localStorage.getItem("ml_guest_session")
    if (!guestSession) {
      guestSession = crypto.randomUUID()
      localStorage.setItem("ml_guest_session", guestSession)
    }

    // Optimistically update locally
    const updatedMoments = gallery.moments.map((moment) => {
      const updatedPhotos = moment.photos.map((p) => {
        if (p.id === photoId) {
          const counts = { ...p.reaction_counts }
          counts[reactionType as keyof typeof counts] = (counts[reactionType as keyof typeof counts] || 0) + 1
          return { ...p, reaction_counts: counts }
        }
        return p
      })
      return { ...moment, photos: updatedPhotos }
    })
    setGallery({ ...gallery, moments: updatedMoments })

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${apiBase}/gallery/${slug}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: photoId,
          reaction_type: reactionType,
          session_id: guestSession
        })
      })
      if (!res.ok) throw new Error("Failed to register reaction")
    } catch (err) {
      console.error("Failed to persist reaction:", err)
    }
  }

  // Compile all flat photos for lightbox slideshow navigation
  const flatPhotos = gallery 
    ? gallery.moments.flatMap((m) => m.photos) 
    : []

  const handlePrev = () => {
    if (lightboxIndex === null) return
    setLightboxIndex(lightboxIndex === 0 ? flatPhotos.length - 1 : lightboxIndex - 1)
  }

  const handleNext = () => {
    if (lightboxIndex === null) return
    setLightboxIndex(lightboxIndex === flatPhotos.length - 1 ? 0 : lightboxIndex + 1)
  }

  // Trigger download pack ZIP for filtered cluster
  const handleDownloadFiltered = () => {
    if (activeCluster === null || !gallery) return
    // Trigger download of matching photos sequentially or open in tabs
    const matching = flatPhotos.filter(p => p.face_cluster_ids.includes(activeCluster))
    matching.forEach((p, idx) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = p.url
        a.download = `photo_${idx}.jpg`
        a.target = "_blank"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, idx * 600) // Stagger downloads to avoid browser block
    })
  }

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 text-center font-sans select-none">
        <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Unlocking Cinematic Gallery...</span>
      </div>
    )
  }

  if (errorMsg || !gallery) {
    return (
      <div className="w-full h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-8 text-center px-6 selection:bg-[#c9a96e] selection:text-[#0a0a0f] font-sans">
        <h1 className="text-3xl font-serif font-black text-[#c9a96e]">MemoryLane</h1>
        <div className="text-xs md:text-sm font-light text-zinc-400 max-w-sm leading-relaxed">
          {isReviewPending ? (
            <div className="space-y-3">
              <span className="block text-[#c9a96e] font-serif font-black text-lg mb-2">✨ Under Curation Review</span>
              <p>This gallery isn't live yet.</p>
              <p>The creator is putting the finishing touches on it.</p>
              <p>Check back soon.</p>
            </div>
          ) : (
            <p>{errorMsg || "This event gallery is currently unavailable."}</p>
          )}
        </div>
        <a 
          href="/" 
          className="inline-flex items-center bg-[#faf9f7] text-[#0a0a0f] hover:bg-[#c9a96e] font-mono text-[10px] font-bold uppercase tracking-widest py-4 px-8 rounded-full shadow-lg transition-all"
        >
          Back to Home
        </a>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#0a0a0f] text-white min-h-screen relative font-sans selection:bg-[#c9a96e] selection:text-zinc-950">
      
      {/* 1. Cover Photo Hero */}
      <GalleryCover
        eventName={gallery.event_name}
        eventType={gallery.event_type}
        eventDate={gallery.event_date}
        eventLocation={gallery.event_location}
        coverPhotoUrl={gallery.cover_photo_url}
        totalReactions={totalReactions}
      />

      {/* 2. Sticky Face Filter strip */}
      {gallery.face_clusters && gallery.face_clusters.length > 0 && (() => {
        // Filter out duplicate cluster_index cards if database registers multiple entries
        const uniqueClusters = gallery.face_clusters.reduce((acc: any[], current: any) => {
          const hasIndex = acc.some(item => item.cluster_index === current.cluster_index)
          if (!hasIndex) {
            acc.push(current)
          }
          return acc
        }, [])

        return (
          <FaceFilterStrip
            faceClusters={uniqueClusters}
            activeCluster={activeCluster}
            onSelectCluster={setActiveCluster}
            filteredCount={flatPhotos.filter(p => activeCluster !== null && p.face_cluster_ids.includes(activeCluster)).length}
            isFiltered={activeCluster !== null}
            onDownloadFiltered={handleDownloadFiltered}
            tier={gallery.tier}
          />
        )
      })()}

      {/* 3. Moments sticky Anchor Bar */}
      {gallery.moments && gallery.moments.length > 1 && (
        <MomentNav
          moments={gallery.moments.map(m => ({ id: m.id, name: m.name }))}
          activeMoment={activeMoment}
          onSelectMoment={(id) => {
            setActiveMoment(id)
            const el = document.getElementById(id)
            if (el) {
              const yOffset = -150
              const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
              window.scrollTo({ top: y, behavior: "smooth" })
            }
          }}
        />
      )}

      {/* 4. Moment Sections Photos Masonry Grids */}
      {gallery.moments.map((moment) => (
        <MomentSection
          key={moment.id}
          momentId={moment.id}
          momentName={moment.name}
          photos={moment.photos}
          activeCluster={activeCluster}
          onOpenLightbox={(photoIdx) => {
            // Find global index in flat list
            const pId = moment.photos[photoIdx].id
            const globIdx = flatPhotos.findIndex(p => p.id === pId)
            setLightboxIndex(globIdx)
          }}
          onReact={handleReact}
        />
      ))}

      {/* 5. Guest uploads dropzone */}
      {gallery.allow_guest_uploads && (
        <GuestUploadSection
          slug={slug}
          onUploadSuccess={fetchGallery}
        />
      )}

      {/* 6. Dynamic Loop CTA Footer */}
      <GalleryFooter
        slug={slug}
        eventName={gallery.event_name}
      />

      {/* 7. Image Slideshow Lightbox */}
      <PhotoLightbox
        photos={flatPhotos}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onPrev={handlePrev}
        onNext={handleNext}
        onReact={handleReact}
      />
    </div>
  )
}
