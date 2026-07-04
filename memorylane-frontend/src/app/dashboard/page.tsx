"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { api, API_BASE_URL } from "@/lib/api"
import {
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowRight,
  LogOut,
  ExternalLink,
  Camera,
  Layers,
  Save,
  Loader2,
  Eye,
  AlertTriangle,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { Input } from "@/components/ui/input"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', color: 'gray', bg: 'bg-zinc-50', text: 'text-zinc-500', border: 'border-zinc-200' },
  paid: { label: 'Payment Confirmed', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-150' },
  processing: { label: 'AI Creating Gallery...', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-150' },
  review_ready: { label: 'Ready to Review', color: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-150' },
  published: { label: 'Live', color: 'green', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-100' },
  failed: { label: 'Processing Failed', color: 'red', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-100' },
  refunded: { label: 'Refunded', color: 'gray', bg: 'bg-zinc-100', text: 'text-zinc-500', border: 'border-zinc-200' },
  expired: { label: 'Expired', color: 'gray', bg: 'bg-zinc-100', text: 'text-zinc-400', border: 'border-zinc-200' }
}

export default function UserDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Photographer settings editing
  const [showPhotographerSettings, setShowPhotographerSettings] = useState(false)
  const [studioName, setStudioName] = useState("")
  const [studioWebsite, setStudioWebsite] = useState("")
  const [studioLocation, setStudioLocation] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Delete gallery state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Countdown timers state for review_ready galleries
  const [countdowns, setCountdowns] = useState<Record<string, string>>({})

  const loadDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = `/login?next=${encodeURIComponent("/dashboard")}`
        return
      }
      setUser(session.user)

      // Query profiles table
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (prof) {
        setProfile(prof)
        setStudioName(prof.studio_name || "")
        setStudioWebsite(prof.studio_website || "")
        setStudioLocation(prof.studio_location || "")
      }

      // Fetch dashboard galleries from API router which fetches correct status values
      let loaded = false
      try {
        const res = await api.get("/gallery/dashboard/galleries")
        if (res.data && res.data.galleries && res.data.galleries.length > 0) {
          setOrders(res.data.galleries)
          loaded = true
        }
      } catch (apiErr) {
        console.warn("Failed to fetch dashboard galleries via API, falling back to direct Supabase query:", apiErr)
      }

      if (!loaded) {
        // Fallback directly querying orders table
        const { data: userOrders, error } = await supabase
          .from("orders")
          .select("*, photo_batches(id, pipeline_result, total_uploaded)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })

        if (!error && userOrders) {
          const mappedOrders = userOrders.map((o: any) => {
            const batch = o.photo_batches?.[0]
            const selectedPhotos = batch?.pipeline_result?.selected_photos || []
            const photoCount = selectedPhotos.length || batch?.total_uploaded || 0
            return {
              ...o,
              slug: o.event_slug,
              photo_count: photoCount
            }
          })
          setOrders(mappedOrders)
        }
      }
    } catch (err) {
      console.error("Dashboard data load failed:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  // Timer tick for auto-publish deadlines
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns: Record<string, string> = {}
      orders.forEach(o => {
        if (o.status === "review_ready" && o.review_deadline) {
          const deadline = new Date(o.review_deadline).getTime()
          const now = new Date().getTime()
          const diff = deadline - now
          if (diff <= 0) {
            newCountdowns[o.id] = "auto-publishing..."
          } else {
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            newCountdowns[o.id] = `${hours}h ${minutes}m`
          }
        }
      })
      setCountdowns(newCountdowns)
    }, 1000)

    return () => clearInterval(interval)
  }, [orders])

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out of your MemoryLane account?")
    if (confirmLogout) {
      await supabase.auth.signOut()
      router.push("/")
    }
  }

  const handleDeleteGallery = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      await api.delete(`/orders/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setDeleteTarget(null)
      setDeleteConfirmText("")
      // Reload dashboard list
      await loadDashboard()
    } catch (err) {
      console.error("Failed to delete gallery:", err)
      alert("Failed to delete gallery. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveStudioProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const apiBase = API_BASE_URL
      const res = await fetch(`${apiBase}/photographer/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          studio_name: studioName,
          studio_website: studioWebsite || null,
          studio_location: studioLocation || null
        })
      })

      if (!res.ok) throw new Error("Failed to update profile settings")

      // Refresh
      await loadDashboard()
      setShowPhotographerSettings(false)
    } catch (err) {
      console.error(err)
      alert("Failed to save photographer settings.")
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center text-zinc-900 select-none">
        <Clock className="w-6 h-6 animate-spin text-zinc-400 mb-2" />
        <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">Loading Dashboard...</span>
      </div>
    )
  }

  const totalGalleries = orders.length
  const completedGalleries = orders.filter(o => o.status === "published").length
  const totalViews = orders.reduce((sum, o) => sum + (o.view_count || 0), 0)

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Memory Curator"

  // Get first review-ready order for urgent dashboard banner
  const urgentReviewOrder = orders.find(o => o.status === "review_ready")

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-zinc-900 font-sans py-24 px-6 md:px-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Top Navbar */}
        <header className="flex justify-between items-center pb-6 border-b border-zinc-200/60">
          <Link href="/" className="flex items-center gap-3 group focus:outline-none select-none">
            <Logo className="w-7 h-7 group-hover:scale-105 transition-transform" />
            <span className="font-geist-mono font-bold text-xs uppercase tracking-widest text-zinc-800 group-hover:text-zinc-950 transition-colors">MemoryLane</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              Home
            </Link>
            {profile?.is_photographer && (
              <Button
                variant="outline"
                onClick={() => setShowPhotographerSettings(!showPhotographerSettings)}
                className="text-[10px] font-bold font-geist-mono uppercase tracking-widest border-zinc-200 hover:bg-zinc-50"
              >
                <Camera className="w-3.5 h-3.5 mr-2" />
                Studio Profile
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-900 hover:bg-transparent"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        {/* Photographer settings drawer inline */}
        {showPhotographerSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-zinc-250 rounded-[32px] p-8 shadow-premium space-y-6"
          >
            <div>
              <span className="text-[10px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">White-Label Branding</span>
              <h3 className="text-xl font-serif font-black text-zinc-900 mt-1">Photographer Studio Profile</h3>
              <p className="text-zinc-400 text-xs mt-1">Footers of event galleries shared from your account will show your branding instead of MemoryLane.</p>
            </div>

            <form onSubmit={handleSaveStudioProfile} className="grid sm:grid-cols-3 gap-6 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono font-bold uppercase text-zinc-400">Studio Name</label>
                <Input
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  required
                  placeholder="e.g. Eternal Frame Studio"
                  className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono font-bold uppercase text-zinc-400">Studio Website</label>
                <Input
                  value={studioWebsite}
                  onChange={(e) => setStudioWebsite(e.target.value)}
                  placeholder="e.g. https://eternalframe.in"
                  className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono font-bold uppercase text-zinc-400">Location</label>
                <Input
                  value={studioLocation}
                  onChange={(e) => setStudioLocation(e.target.value)}
                  placeholder="e.g. Delhi, IN"
                  className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end gap-3 mt-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowPhotographerSettings(false)}
                  className="text-[10px] font-bold font-geist-mono uppercase tracking-wider h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[10px] font-bold font-geist-mono uppercase tracking-wider px-6 h-10 shadow-md"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-zinc-200/80 rounded-[32px] p-8 md:p-10 shadow-premium">
          <div className="space-y-2">
            <span className="text-[10px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">
              {profile?.is_photographer ? "Photographer Workspace" : "Personal Workspace"}
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-black tracking-tightest leading-none text-zinc-900">
              Welcome back, {displayName}
            </h2>
            {profile?.is_photographer && profile?.studio_name && (
              <p className="text-xs text-[#c9a96e] font-bold font-mono uppercase tracking-wider mt-1.5">Studio: {profile.studio_name}</p>
            )}
            <p className="text-xs text-zinc-400 font-light font-geist-mono mt-1">{user?.email}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {!profile?.is_photographer && (
              <Link href="/photographer" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full border-zinc-200 hover:bg-zinc-50 rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono">
                  photographer join
                </Button>
              </Link>
            )}
            <Link href="/create" className="w-full sm:w-auto">
              <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-md group shrink-0">
                Create Event Gallery
                <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 sm:p-6 shadow-sm">
            <span className="block text-[9px] font-bold font-geist-mono text-zinc-400 uppercase tracking-wider">Galleries Built</span>
            <span className="block text-2xl font-serif font-black text-zinc-800 mt-2">{totalGalleries}</span>
          </div>
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 sm:p-6 shadow-sm">
            <span className="block text-[9px] font-bold font-geist-mono text-zinc-400 uppercase tracking-wider">AI Live</span>
            <span className="block text-2xl font-serif font-black text-[#c9a96e] mt-2">{completedGalleries} live</span>
          </div>
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 sm:p-6 shadow-sm">
            <span className="block text-[9px] font-bold font-geist-mono text-zinc-400 uppercase tracking-wider">Total Views</span>
            <span className="block text-2xl font-serif font-black text-zinc-800 mt-2">{totalViews}</span>
          </div>
        </div>

        {/* Urgent Review Banner if any review_ready orders exist */}
        {urgentReviewOrder && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-50 border border-purple-200/80 rounded-3xl p-6 shadow-premium flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-1">
              <span className="bg-purple-100 text-purple-800 text-[8.5px] font-bold font-geist-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-purple-200">
                Action Required
              </span>
              <h4 className="text-lg font-serif font-black text-purple-950 mt-1">
                🎉 Your "{urgentReviewOrder.event_name}" gallery is ready!
              </h4>
              <p className="text-xs text-purple-700 leading-relaxed font-light font-geist-mono">
                Review captions, group clusters, and publish it now. Auto-publishes in <strong className="font-bold">{countdowns[urgentReviewOrder.id] || "24 hours"}</strong> if no action is taken.
              </p>
            </div>
            <Link href={`/dashboard/gallery/${urgentReviewOrder.slug}/review`}>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-md whitespace-nowrap">
                Review Now →
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Order History */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold font-geist-mono uppercase tracking-wider text-zinc-400">My Galleries</h3>

          {orders.length === 0 ? (
            <div className="bg-white border border-zinc-200/80 rounded-[32px] p-12 text-center space-y-4">
              <Layers className="w-8 h-8 text-zinc-350 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-850">No galleries found</h4>
                <p className="text-zinc-400 text-xs font-light max-w-xs mx-auto leading-relaxed">
                  Start your first event gallery creation! Our AI will sequence photos, group faces, and generate cinematic captions in minutes.
                </p>
              </div>
              <Link href="/create" className="inline-block pt-2">
                <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6 text-[10px] font-bold uppercase tracking-widest font-geist-mono h-10 shadow-sm">
                  Create Gallery
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const isPublished = order.status === "published"
                const isDraft = order.status === "draft"
                const isProcessing = order.status === "processing" || order.status === "paid"
                const isReviewReady = order.status === "review_ready"

                const config = STATUS_CONFIG[order.status] || {
                  label: order.status,
                  color: 'gray',
                  bg: 'bg-zinc-50',
                  text: 'text-zinc-500',
                  border: 'border-zinc-200'
                }

                return (
                  <motion.div
                    key={order.id}
                    whileHover={{ y: -2 }}
                    className="bg-white border border-zinc-200/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-[8.5px] font-bold font-geist-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${isProcessing ? "animate-pulse" : ""}`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] font-bold font-geist-mono text-zinc-400 uppercase tracking-widest">{order.tier} Edition</span>
                      </div>
                      <h4 className="text-lg font-serif font-black text-zinc-900 leading-tight">
                        {order.event_name || order.book_title || "My Event Gallery"}
                      </h4>
                      <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-geist-mono uppercase font-medium">
                        <span>{order.created_at ? new Date(order.created_at).toLocaleDateString() : "Just created"}</span>
                        <span>•</span>
                        <span>{order.photo_count || 0} Photos</span>
                        <span>•</span>
                        <span>{order.view_count || 0} Views</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:self-end">
                      {isPublished && order.slug && (
                        <>
                          <Link href={`/e/${order.slug}`} target="_blank">
                            <Button variant="outline" className="border-zinc-200 hover:bg-zinc-50 rounded-xl text-[9px] font-bold font-geist-mono uppercase tracking-wider h-10 px-4">
                              <ExternalLink className="w-3.5 h-3.5 mr-2" />
                              Open Gallery
                            </Button>
                          </Link>
                        </>
                      )}

                      {isReviewReady && order.slug && (
                        <Link href={`/dashboard/gallery/${order.slug}/review`}>
                          <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] font-bold font-geist-mono uppercase tracking-wider h-10 px-5 shadow-md">
                            Review Now →
                          </Button>
                        </Link>
                      )}

                      {isDraft && (
                        <Link href={`/create/upload?type=${order.book_type || 'classic'}&tier=${order.tier}&event_name=${encodeURIComponent(order.event_name || 'My Event')}&event_date=${order.event_date || ''}&event_location=${encodeURIComponent(order.event_location || '')}`}>
                          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-[9px] font-bold font-geist-mono uppercase tracking-wider h-10 px-5 shadow-md">
                            Resume upload
                          </Button>
                        </Link>
                      )}

                      {isProcessing && (
                        <div className="flex items-center gap-3">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="outline" className="border-zinc-200 hover:bg-zinc-50 rounded-xl text-[9px] font-bold font-geist-mono uppercase tracking-wider h-10 px-4">
                              Track Progress
                            </Button>
                          </Link>
                          <div className="flex items-center gap-2 text-[10px] font-bold font-geist-mono uppercase text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>AI pipeline running...</span>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        onClick={() => setDeleteTarget(order)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-[9px] font-bold font-geist-mono uppercase tracking-wider h-10 px-4"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-zinc-200 rounded-[32px] max-w-md w-full p-8 shadow-premium space-y-6"
          >
            <div className="space-y-2 text-center select-none">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif font-black text-zinc-900">Delete Gallery?</h3>
              <p className="text-zinc-400 text-xs font-light max-w-sm mx-auto leading-relaxed">
                This action is permanent. All uploaded photos, captions, face clusters, and the public sharing link will be deleted forever.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-center select-none">
                <p className="text-[10px] font-bold font-geist-mono uppercase tracking-wider text-zinc-400 mb-1">Type name to confirm</p>
                <p className="text-sm font-serif font-black text-zinc-800">
                  {deleteTarget.event_name || deleteTarget.book_title || "My Event Gallery"}
                </p>
              </div>

              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Re-enter gallery name exactly"
                className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-11"
              />
            </div>

            <div className="flex gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteConfirmText("")
                }}
                className="flex-1 text-[10px] font-bold font-geist-mono uppercase tracking-wider h-11"
              >
                Cancel
              </Button>
              <Button
                disabled={deleteConfirmText !== (deleteTarget.event_name || deleteTarget.book_title || "My Event Gallery") || isDeleting}
                onClick={handleDeleteGallery}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-zinc-100 disabled:text-zinc-300 text-white rounded-xl text-[10px] font-bold font-geist-mono uppercase tracking-wider h-11 shadow-sm"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Trash2 className="w-3.5 h-3.5 mr-2" />}
                Delete Gallery
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
