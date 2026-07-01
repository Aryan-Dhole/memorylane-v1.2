"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { api } from "@/lib/api"
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
  AlertTriangle
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
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })

        if (!error && userOrders) {
          const mappedOrders = userOrders.map((o: any) => ({
            ...o,
            slug: o.event_slug
          }))
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
      window.location.href = "/"
    }
  }

  const handleSaveStudioProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
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

          <div className="flex items-center gap-3">
            {!profile?.is_photographer && (
              <Link href="/photographer">
                <Button variant="outline" className="border-zinc-200 hover:bg-zinc-50 rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono">
                  photographer join
                </Button>
              </Link>
            )}
            <Link href="/create">
              <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-md group shrink-0">
                Create Event Gallery
                <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-6 shadow-sm">
            <span className="block text-[9px] font-bold font-geist-mono text-zinc-400 uppercase tracking-wider">Galleries Built</span>
            <span className="block text-2xl font-serif font-black text-zinc-800 mt-2">{totalGalleries}</span>
          </div>
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-6 shadow-sm">
            <span className="block text-[9px] font-bold font-geist-mono text-zinc-400 uppercase tracking-wider">AI Live</span>
            <span className="block text-2xl font-serif font-black text-[#c9a96e] mt-2">{completedGalleries} live</span>
          </div>
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-6 shadow-sm">
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
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
