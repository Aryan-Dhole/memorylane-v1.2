"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { API_BASE_URL } from "@/lib/api"
import { Sparkles, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react"

export default function JoinPhotographerPortal() {
  const [studioName, setStudioName] = useState("")
  const [studioWebsite, setStudioWebsite] = useState("")
  const [studioLocation, setStudioLocation] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [sessionUser, setSessionUser] = useState<any>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setSessionUser(session.user)
      } else {
        // Redirect to login if unauthenticated, returning back to join
        window.location.href = `/login?next=${encodeURIComponent("/photographer/join")}`
      }
    }
    checkUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studioName) {
      setErrorMsg("Studio name is required.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setStatus("")

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const apiBase = API_BASE_URL
      const res = await fetch(`${apiBase}/photographer/join`, {
        method: "POST",
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

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to join portal.")
      }

      setStatus("Welcome! Redirecting to your dashboard...")
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Something went wrong registering your details.")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionUser) {
    return (
      <div className="w-full h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center font-sans select-none">
        <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Synchronizing Photographer Profile...</span>
      </div>
    )
  }

  return (
    <div className="w-full bg-zinc-950 text-white min-h-screen font-sans selection:bg-[#c9a96e] selection:text-zinc-950 flex items-center justify-center p-6 select-none relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,169,110,0.02),transparent)] pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0a0a0f] border border-zinc-900 rounded-[32px] p-8 md:p-12 space-y-8 z-10 shadow-premium-dark relative">
        {/* Back button */}
        <a 
          href="/photographer" 
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-zinc-500 hover:text-white font-mono text-[9px] uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </a>

        <div className="text-center space-y-3 pt-4">
          <div className="mx-auto w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#c9a96e]">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-3xl font-serif font-black tracking-tight text-white">Create studio profile</h2>
          <p className="text-zinc-500 text-xs font-light max-w-xs mx-auto leading-relaxed">
            Configure your white-label settings. You can edit this anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Studio Name */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400">Studio / Business Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Pixel Clicks, Eternal Stories"
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              disabled={loading}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c9a96e] transition-colors placeholder:text-zinc-800"
            />
          </div>

          {/* Studio Website */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400">Website / Portfolio URL (Optional)</label>
            <input
              type="url"
              placeholder="e.g. https://mystudioportfolio.com"
              value={studioWebsite}
              onChange={(e) => setStudioWebsite(e.target.value)}
              disabled={loading}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c9a96e] transition-colors placeholder:text-zinc-800"
            />
          </div>

          {/* Studio Location */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400">City / Location (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Mumbai, Delhi NCR"
              value={studioLocation}
              onChange={(e) => setStudioLocation(e.target.value)}
              disabled={loading}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c9a96e] transition-colors placeholder:text-zinc-800"
            />
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="text-rose-400 text-xs font-mono bg-rose-950/20 border border-rose-900/40 p-3.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          {status && (
            <div className="text-emerald-400 text-xs font-mono bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#faf9f7] text-zinc-950 font-mono text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-[#c9a96e] transition-all shadow-lg focus:outline-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                Registering Studio...
              </>
            ) : (
              <>
                Complete Registration
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
