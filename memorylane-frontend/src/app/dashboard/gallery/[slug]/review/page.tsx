"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { api } from "@/lib/api"
import { 
  ArrowLeft, Check, X, Loader2, Play, AlertTriangle, Clock, Edit2, Plus, Eye, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"

interface Photo {
  id: string
  url: string
  thumb_url: string
  caption: string
  is_selected: boolean
  moment_id: string
  scene_label: string
  face_cluster_ids: number[]
  sequence_index: number
}

interface Moment {
  id: string
  name: string
  display_order: number
}

interface ReviewData {
  order_id: string
  event_name: string
  status: string
  review_deadline: string
  published_at: string
  auto_published: boolean
  tier: string
  photos: Photo[]
  moments: Moment[]
  total_photos: number
  total_uploaded: number
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function GalleryReviewPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  
  // Local modifications state
  const [photos, setPhotos] = useState<Photo[]>([])
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [showAddPhotosPanel, setShowAddPhotosPanel] = useState(false)

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState("")

  const loadReviewData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
        return
      }

      const res = await api.get(`/gallery/${slug}/review`)
      setReviewData(res.data)
      setPhotos(res.data.photos || [])
    } catch (err) {
      console.error("Failed to load review data", err)
      alert("Failed to load review details. Make sure you are the owner of this gallery.")
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviewData()
  }, [slug])

  // Timer logic
  useEffect(() => {
    if (!reviewData?.review_deadline) return

    const deadline = new Date(reviewData.review_deadline).getTime()

    const updateTimer = () => {
      const now = new Date().getTime()
      const diff = deadline - now

      if (diff <= 0) {
        setTimeLeft("Expired (Publishing automatically...)")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [reviewData])

  // Save changes to backend
  const savePhotoChanges = async (updatedPhotos: Photo[]) => {
    setSaving(true)
    try {
      // Find delta changes
      const originalPhotos = reviewData?.photos || []
      const updates = updatedPhotos.map(p => {
        const orig = originalPhotos.find(o => o.id === p.id)
        if (!orig) return null
        
        const isSelChanged = orig.is_selected !== p.is_selected
        const isCapChanged = orig.caption !== p.caption

        if (isSelChanged || isCapChanged) {
          return {
            photo_id: p.id,
            is_selected: p.is_selected,
            caption_edited: p.caption
          }
        }
        return null
      }).filter(Boolean)

      if (updates.length > 0) {
        await api.patch(`/gallery/${slug}/review/photos`, { updates })
        // Update local reviewData to reset baseline
        if (reviewData) {
          setReviewData({
            ...reviewData,
            photos: updatedPhotos
          })
        }
      }
    } catch (err) {
      console.error("Failed to auto-save changes", err)
    } finally {
      setSaving(false)
    }
  }

  // Toggle selection (Exclude / Include)
  const handleToggleSelect = (photoId: string) => {
    const updated = photos.map(p => p.id === photoId ? { ...p, is_selected: !p.is_selected } : p)
    setPhotos(updated)
    savePhotoChanges(updated)
  }

  // Edit caption
  const startEditCaption = (photo: Photo) => {
    setEditingPhotoId(photo.id)
    setEditingText(photo.caption)
  }

  const saveCaption = (photoId: string) => {
    const updated = photos.map(p => p.id === photoId ? { ...p, caption: editingText } : p)
    setPhotos(updated)
    setEditingPhotoId(null)
    savePhotoChanges(updated)
  }

  // Publish gallery
  const handlePublish = async () => {
    setPublishing(true)
    try {
      await api.post(`/gallery/${slug}/publish`)
      router.push(`/e/${slug}`)
    } catch (err) {
      console.error("Failed to publish gallery", err)
      alert("Failed to publish your gallery. Please try again.")
      setPublishing(false)
    }
  }

  const selectedPhotos = photos.filter(p => p.is_selected)
  const unselectedPhotos = photos.filter(p => !p.is_selected)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center text-zinc-900 select-none">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
        <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">Loading your curation workspace...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-zinc-900 font-sans py-24 px-4 md:px-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Back and Status banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6">
          <div className="space-y-2">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-zinc-900">
              Review: {reviewData?.event_name}
            </h1>
            <div className="flex items-center gap-4 text-xs text-zinc-550">
              <span className="font-geist-mono uppercase tracking-wider font-bold">Selected: {selectedPhotos.length} / {photos.length} Photos</span>
              {saving ? (
                <span className="flex items-center gap-1.5 text-zinc-400 font-geist-mono uppercase tracking-wider font-bold text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Auto-saving...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-500 font-geist-mono uppercase tracking-wider font-bold text-[10px]">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Publishing controls header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {reviewData?.status === "review_ready" && (
              <div className="bg-amber-50 border border-amber-200/70 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-amber-850 font-geist-mono">
                <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                <div className="text-[10px] leading-tight">
                  <span className="block font-bold uppercase">AUTO-PUBLISHES IN:</span>
                  <span className="text-xs font-black tracking-tight">{timeLeft || "calculating..."}</span>
                </div>
              </div>
            )}

            <Button 
              onClick={handlePublish}
              disabled={publishing || selectedPhotos.length === 0}
              className="bg-zinc-950 hover:bg-zinc-900 text-white rounded-full px-8 py-6 text-xs font-bold uppercase tracking-widest font-geist-mono shadow-md flex items-center justify-center gap-2"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#c9a96e]" />
              )}
              Publish Gallery Now
            </Button>
          </div>
        </div>

        {/* Content Review Area */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Grid: Selected Photos */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-serif font-black text-zinc-800">Selected Curation</h2>
              <span className="text-[10px] text-zinc-400 font-geist-mono uppercase tracking-wider">Scroll & Edit</span>
            </div>

            {selectedPhotos.length === 0 ? (
              <div className="bg-white border border-zinc-200 border-dashed rounded-[32px] p-16 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-zinc-400 mx-auto" />
                <h4 className="text-sm font-bold font-geist-mono uppercase text-zinc-800">No photos selected</h4>
                <p className="text-xs text-zinc-550 max-w-xs mx-auto leading-relaxed font-light">
                  You have excluded all photos. Select "+ Add more photos" below to include candidates.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedPhotos.map((photo, i) => {
                  const moment = reviewData?.moments.find(m => m.id === photo.moment_id)
                  
                  return (
                    <motion.div 
                      key={photo.id}
                      layout
                      className="bg-white border border-zinc-200/80 rounded-[32px] overflow-hidden p-6 shadow-premium relative group flex flex-col md:flex-row gap-6 items-start"
                    >
                      {/* Image Frame */}
                      <div className="w-full md:w-48 aspect-[4/3] md:aspect-square bg-zinc-50 border border-zinc-150 rounded-2xl overflow-hidden relative shrink-0">
                        <img 
                          src={photo.url} 
                          alt="Curation candidate" 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          onClick={() => handleToggleSelect(photo.id)}
                          className="absolute top-3 right-3 bg-zinc-950/80 hover:bg-rose-600/90 text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-md border border-white/20"
                          title="Exclude from gallery"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Info & Caption Edit Frame */}
                      <div className="flex-1 space-y-4 w-full">
                        <div className="flex flex-wrap gap-2">
                          <span className="bg-zinc-50 text-zinc-500 border border-zinc-200/60 rounded-xl px-3 py-1 text-[9px] font-bold uppercase tracking-wider font-geist-mono">
                            Moment: {moment?.name || "Candid Magic"}
                          </span>
                          <span className="bg-zinc-50 text-zinc-500 border border-zinc-200/60 rounded-xl px-3 py-1 text-[9px] font-bold uppercase tracking-wider font-geist-mono">
                            Scene: {photo.scene_label || "capture"}
                          </span>
                        </div>

                        {editingPhotoId === photo.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4 focus:border-zinc-400"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => saveCaption(photo.id)}
                                className="bg-zinc-900 text-white hover:bg-zinc-800 text-[10px] font-bold uppercase font-geist-mono rounded-lg px-4 h-8"
                              >
                                Save
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setEditingPhotoId(null)}
                                className="text-zinc-400 hover:text-zinc-700 text-[10px] font-bold uppercase font-geist-mono rounded-lg h-8"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEditCaption(photo)}
                            className="bg-zinc-50 hover:bg-zinc-100/70 border border-zinc-150 border-dashed rounded-2xl p-4 cursor-pointer relative group/caption transition-colors"
                          >
                            <p className="text-xs text-zinc-650 italic leading-relaxed pr-6">
                              "{photo.caption || "Click to add a custom description for this beautiful moment..."}"
                            </p>
                            <Edit2 className="w-3.5 h-3.5 text-zinc-400 group-hover/caption:text-zinc-700 absolute top-4 right-4 transition-colors" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Excluded/Unselected photos review */}
          <div className="bg-white border border-zinc-200 rounded-[32px] p-6 shadow-premium space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3.5">
              <h3 className="text-sm font-bold font-geist-mono uppercase tracking-widest text-zinc-850">
                Excluded Photos ({unselectedPhotos.length})
              </h3>
              <Plus className="w-4 h-4 text-zinc-400" />
            </div>
            
            <p className="text-[10.5px] text-zinc-450 leading-relaxed font-light">
              These photos were filtered out by the AI scoring system or manual exclusion. Click on any photo card to include it back.
            </p>

            {unselectedPhotos.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-[10.5px] italic">
                No excluded photos in this batch.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {unselectedPhotos.map((photo) => (
                  <div 
                    key={photo.id}
                    onClick={() => handleToggleSelect(photo.id)}
                    className="aspect-square bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm hover:border-zinc-400 transition-all"
                    title="Include in gallery"
                  >
                    <img 
                      src={photo.url} 
                      alt="Excluded candidate" 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity" 
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors flex items-center justify-center">
                      <div className="bg-white/95 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all text-zinc-800">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex justify-end border-t border-zinc-200/60 pt-8 mt-6">
          <Button 
            onClick={handlePublish}
            disabled={publishing || selectedPhotos.length === 0}
            className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-full px-10 py-6 text-xs font-bold uppercase tracking-widest font-geist-mono shadow-md flex items-center gap-2"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#c9a96e]" />
            )}
            Publish Gallery Now
          </Button>
        </div>

      </div>
    </div>
  )
}
