"use client"

import React, { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import CinematicViewer from "@/components/book/CinematicViewer"
import Confetti from "@/components/ui/Confetti"
import { RefreshCw, Sparkles, X, Save } from "lucide-react"

interface PageProps {
  params: Promise<{ trial_id: string }>;
}

export default function FreeTrialResult({ params }: PageProps) {
  const resolvedParams = use(params)
  const trialId = resolvedParams.trial_id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [trialData, setTrialData] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showSaveBanner, setShowSaveBanner] = useState(true)
  const [triggerConfetti, setTriggerConfetti] = useState(false)

  useEffect(() => {
    // 1. Fetch auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
      if (session) {
        setShowSaveBanner(false)
      }
    })

    // 2. Fetch trial photos
    const fetchTrialResult = async () => {
      try {
        const res = await api.get(`/trial/result/${trialId}`)
        setTrialData(res.data)
        if (res.data.status === "ready") {
          setTriggerConfetti(true)
        }
      } catch (err) {
        console.error("Failed to fetch trial details:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTrialResult()
  }, [trialId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-[#faf9f7] select-none">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-650 mb-3" />
        <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-500">Retrieving Curation Spreads...</span>
      </div>
    )
  }

  if (!trialData || trialData.status === "expired") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-[#faf9f7] text-center p-6 space-y-4">
        <h2 className="text-xl font-serif font-black">Trial Preview Expired</h2>
        <p className="text-zinc-500 text-xs max-w-xs mx-auto leading-relaxed">
          Free trial previews are stored for 24 hours. Upload files again to generate a new preview.
        </p>
        <button 
          onClick={() => router.push("/try")}
          className="bg-white text-zinc-950 px-6 py-2.5 rounded-full text-xs font-bold font-geist-mono uppercase tracking-wider shadow-md"
        >
          Try Free Again
        </button>
      </div>
    )
  }

  // Format photos to match CinematicViewer props
  const formattedPhotos = trialData.photos.map((p: any, idx: number) => ({
    url: p.path,
    caption: p.caption,
    chapter: 0,
    chapter_name: "Story Preview"
  }))

  const chapters = [
    { index: 0, name: "AI Story Curation", photo_count: formattedPhotos.length }
  ]

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-[#faf9f7]">
      {triggerConfetti && <Confetti />}

      <CinematicViewer 
        title="My Trial Story"
        eventType="Free Preview"
        createdAt={new Date().toLocaleDateString()}
        photos={formattedPhotos}
        chapters={chapters}
        token={trialId}
        isTrial={true}
        trialId={trialId}
      />

      {/* Save your trial sticky bottom banner */}
      {showSaveBanner && !isLoggedIn && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md bg-[#18181b] border border-white/10 rounded-2xl p-5 shadow-2xl z-50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5 animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-geist-mono">Save your preview</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-light">
              Your free trial preview expires in 23 hours. Sign up to save these photos and captions!
            </p>
            <div className="flex gap-3 pt-1">
              <button 
                onClick={() => router.push(`/login?next=/create?from_trial=${trialId}`)}
                className="bg-white text-zinc-950 px-4 py-1.5 rounded-lg text-[9px] font-bold font-geist-mono uppercase tracking-wider shadow-md hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Sign Up Free
              </button>
              <button 
                onClick={() => setShowSaveBanner(false)}
                className="text-zinc-500 hover:text-zinc-300 text-[9px] font-bold font-geist-mono uppercase tracking-widest"
              >
                Maybe Later
              </button>
            </div>
          </div>
          <button 
            onClick={() => setShowSaveBanner(false)} 
            className="text-zinc-500 hover:text-zinc-300 shrink-0 cursor-pointer border-none bg-transparent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
