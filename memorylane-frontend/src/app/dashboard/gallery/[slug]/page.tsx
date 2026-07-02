"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { api, API_BASE_URL } from "@/lib/api"
import { 
  ArrowLeft, Save, Shield, Users, Check, X, 
  Settings, Loader2, Eye, Heart, Image as ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function GalleryManagementPage({ params }: PageProps) {
  const { slug } = use(params)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Form states
  const [orderId, setOrderId] = useState("")
  const [eventName, setEventName] = useState("")
  const [allowGuestUploads, setAllowGuestUploads] = useState(false)
  const [allowReactions, setAllowReactions] = useState(true)
  
  // Pending Guest Uploads
  const [pendingUploads, setPendingUploads] = useState<any[]>([])
  const [loadingUploads, setLoadingUploads] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    views: 0,
    photoCount: 0,
    reactions: 0
  })

  const loadGalleryManager = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = "/login"
        return
      }

      // Fetch public metadata
      const apiBase = API_BASE_URL
      const res = await fetch(`${apiBase}/gallery/${slug}`)
      if (!res.ok) throw new Error("Failed to load gallery settings")
      
      const data = await res.json()
      
      setOrderId(data.id)
      setEventName(data.event_name)
      setAllowGuestUploads(data.allow_guest_uploads)
      setAllowReactions(data.allow_reactions)
      
      // Compute reactions count
      const reacts = data.moments.reduce((acc: number, m: any) => {
        return acc + m.photos.reduce((pAcc: number, p: any) => {
          const counts = (p.reaction_counts || {}) as Record<string, number>
          return pAcc + Object.values(counts).reduce((a: number, b: number) => a + b, 0)
        }, 0)
      }, 0)

      setStats({
        views: data.view_count || 0,
        photoCount: data.total_photos || 0,
        reactions: reacts
      })

      // Fetch pending uploads
      setLoadingUploads(true)
      const { data: uploads, error: uploadErr } = await supabase
        .from("guest_uploads")
        .select("*")
        .eq("order_id", data.id)
        .eq("status", "pending")
        
      if (!uploadErr && uploads) {
        setPendingUploads(uploads)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg("Failed to synchronize settings panel.")
    } finally {
      setLoading(false)
      setLoadingUploads(false)
    }
  }

  useEffect(() => {
    loadGalleryManager()
  }, [slug])

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const apiBase = API_BASE_URL
      const res = await fetch(`${apiBase}/gallery/${slug}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          event_name: eventName,
          allow_guest_uploads: allowGuestUploads,
          allow_reactions: allowReactions
        })
      })

      if (!res.ok) throw new Error("Failed to save changes")
      
      setSuccessMsg("Gallery configurations updated successfully!")
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update configurations.")
    } finally {
      setSaving(false)
    }
  }

  // Approve guest upload
  const handleApproveUpload = async (upload: any) => {
    try {
      // 1. Resolve default moment
      let momId = null
      const { data: moments } = await supabase.from("gallery_moments").select("id").eq("order_id", orderId).eq("name", "Candid Magic")
      if (moments && moments.length > 0) {
        momId = moments[0].id
      } else {
        // Create Candid Magic moment
        const { data: newMom } = await supabase.from("gallery_moments").insert({
          order_id: orderId,
          name: "Candid Magic",
          display_order: 99
        }).select()
        if (newMom) momId = newMom[0].id
      }

      // Resolve batch
      const { data: batches } = await supabase.from("photo_batches").select("id").eq("order_id", orderId)
      if (!batches || batches.length === 0) return
      const batchId = batches[0].id

      // Query current max sequence_index
      const { data: maxSeq } = await supabase.from("photos").select("sequence_index").eq("batch_id", batchId).order("sequence_index", { ascending: false }).limit(1)
      const nextSeq = maxSeq && maxSeq.length > 0 ? (maxSeq[0].sequence_index + 1) : 0

      // Approve in guest_uploads
      await supabase.from("guest_uploads").update({
        status: "approved",
        approved_at: new Date().toISOString()
      }).eq("id", upload.id)

      // Insert into photos
      await supabase.from("photos").insert({
        batch_id: batchId,
        s3_key: upload.s3_key,
        is_selected: true,
        sequence_index: nextSeq,
        caption_v2: `Uploaded by ${upload.uploader_name || "Guest"}`,
        moment_id: momId
      })

      // Invalidate Redis cache on backend
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${API_BASE_URL}/gallery/${slug}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({})
      })

      // Refresh list
      setPendingUploads(prev => prev.filter(u => u.id !== upload.id))
      setStats(prev => ({ ...prev, photoCount: prev.photoCount + 1 }))
    } catch (err) {
      console.error(err)
      alert("Failed to approve photo.")
    }
  }

  // Reject guest upload
  const handleRejectUpload = async (uploadId: string) => {
    try {
      await supabase.from("guest_uploads").update({ status: "rejected" }).eq("id", uploadId)
      setPendingUploads(prev => prev.filter(u => u.id !== uploadId))
    } catch (err) {
      console.error(err)
      alert("Failed to reject photo.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center text-zinc-900 select-none">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
        <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">Loading Configuration panel...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-zinc-900 font-sans py-24 px-6 md:px-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Back navigation */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">Management Console</span>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-zinc-900 mt-1">{eventName}</h1>
            <p className="text-xs text-zinc-400 font-light mt-1">Manage private sharing limits, guest interactions, and curation approvals.</p>
          </div>
          
          <Link href={`/e/${slug}`} target="_blank">
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-md">
              View Public Link
            </Button>
          </Link>
        </div>

        {/* Stats segment */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Eye className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <span className="block text-[8px] font-bold font-geist-mono text-zinc-450 uppercase">Views</span>
              <span className="block text-xl font-serif font-black text-zinc-800">{stats.views}</span>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <ImageIcon className="w-5 h-5 text-[#c9a96e] shrink-0" />
            <div>
              <span className="block text-[8px] font-bold font-geist-mono text-zinc-450 uppercase">Photos</span>
              <span className="block text-xl font-serif font-black text-zinc-800">{stats.photoCount}</span>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Heart className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="block text-[8px] font-bold font-geist-mono text-zinc-450 uppercase">Reactions</span>
              <span className="block text-xl font-serif font-black text-zinc-800">{stats.reactions}</span>
            </div>
          </div>
        </div>

        {/* Double Column grid */}
        <div className="grid md:grid-cols-3 gap-8 items-start">
          
          {/* Form settings column */}
          <div className="md:col-span-2 bg-white border border-zinc-200 rounded-[32px] p-8 shadow-premium space-y-6">
            <h3 className="text-sm font-bold font-geist-mono uppercase tracking-widest text-zinc-850 flex items-center gap-2 border-b border-zinc-100 pb-3 mb-2">
              <Settings className="w-4 h-4 text-zinc-450" />
              <span>Gallery Configurations</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Event Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono font-bold uppercase text-zinc-500 tracking-widest">Display Event Name</label>
                <Input 
                  value={eventName} 
                  onChange={(e) => setEventName(e.target.value)} 
                  required
                  className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4 border-t border-zinc-100 pt-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-zinc-800">Collaborative Guest Uploads</h4>
                    <p className="text-[10px] text-zinc-450 font-light">Allow wedding/event attendees to add their photos directly.</p>
                  </div>
                  <Switch 
                    checked={allowGuestUploads} 
                    onCheckedChange={setAllowGuestUploads} 
                  />
                </div>

                <div className="flex justify-between items-center border-t border-zinc-100 pt-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-zinc-800">Emoji Reactions</h4>
                    <p className="text-[10px] text-zinc-450 font-light">Allow public browser sessions to react with heart/wow icons.</p>
                  </div>
                  <Switch 
                    checked={allowReactions} 
                    onCheckedChange={setAllowReactions} 
                  />
                </div>
              </div>

              {/* Feedbacks */}
              {errorMsg && <div className="text-rose-450 text-xs font-mono bg-rose-50 border border-rose-100 p-3 rounded-xl">{errorMsg}</div>}
              {successMsg && <div className="text-emerald-500 text-xs font-mono bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">{successMsg}</div>}

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[10px] font-bold font-geist-mono uppercase tracking-widest py-4 px-6 h-10 shadow-md"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                  Save Configurations
                </Button>
              </div>
            </form>
          </div>

          {/* Pending Guest uploads sidebar reviewer */}
          <div className="bg-white border border-zinc-200 rounded-[32px] p-6 shadow-premium space-y-6">
            <h3 className="text-sm font-bold font-geist-mono uppercase tracking-widest text-zinc-850 flex items-center gap-2 border-b border-zinc-100 pb-3 mb-2">
              <Users className="w-4 h-4 text-zinc-450" />
              <span>Review uploads</span>
            </h3>

            {loadingUploads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : pendingUploads.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 space-y-1">
                <Check className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-800">Inbox is clean</p>
                <p className="text-[10px] text-zinc-500 max-w-[180px] mx-auto leading-relaxed">All guest uploads are approved or inbox is empty.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                {pendingUploads.map((upload) => {
                  const url = `${API_BASE_URL}/gallery/${slug}/raw-photo` // (will load S3 presigned or simple key)
                  // Let's resolve simple local crop image or mock placeholder for UI
                  const placeholder = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=120&auto=format&fit=crop"
                  
                  return (
                    <div key={upload.id} className="border border-zinc-150 bg-[#fafafa] rounded-2xl p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 overflow-hidden shrink-0 relative">
                          <img 
                            src={placeholder} 
                            alt="Guest candidate" 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="truncate flex-1">
                          <span className="block text-[10px] font-bold text-zinc-800 truncate uppercase">{upload.uploader_name || "Guest"}</span>
                          <span className="block text-[8px] font-mono text-zinc-400">Score: {Math.round(upload.quality_score)}/100</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => handleApproveUpload(upload)}
                          size="sm"
                          className="flex-1 bg-zinc-900 text-white rounded-lg text-[9px] uppercase tracking-wider font-geist-mono hover:bg-zinc-800 h-8"
                        >
                          Approve
                        </Button>
                        <Button 
                          onClick={() => handleRejectUpload(upload.id)}
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-400 hover:text-rose-500 hover:bg-transparent"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
