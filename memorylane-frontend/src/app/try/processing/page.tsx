"use client"

import React, { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"

function TrialProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const trialId = searchParams.get("id")

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("pending")
  const [statusMessage, setStatusMessage] = useState("Initializing free trial curation pipeline...")

  useEffect(() => {
    if (!trialId) {
      router.push("/try")
      return
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await api.get(`/trial/result/${trialId}`)
        const { status: currentStatus, progress: currentProgress } = res.data

        setProgress(currentProgress)
        setStatus(currentStatus)

        // Set narrative details based on progress status
        if (currentProgress < 30) {
          setStatusMessage("Evaluating photo resolutions, brightness and blur factors (OpenCV)...")
        } else if (currentProgress < 60) {
          setStatusMessage("Analyzing face landmarks, emotion parameters & bursts deduplications...")
        } else if (currentProgress < 90) {
          setStatusMessage("Selecting the best 5 photos and composing lyrical vision captions...")
        } else {
          setStatusMessage("Formatting cinematic stream layouts. Complete!")
        }

        if (currentStatus === "ready" || currentProgress >= 100) {
          clearInterval(intervalId)
          router.push(`/try/result/${trialId}`)
        } else if (currentStatus === "expired") {
          clearInterval(intervalId)
          alert("Your trial session has expired.")
          router.push("/try")
        }
      } catch (err) {
        console.error("Error polling trial status:", err)
        // Auto increments progress locally if network logs are offline
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(intervalId)
            router.push(`/try/result/${trialId}`)
            return 100
          }
          return prev + 10
        })
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [trialId])

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center py-20 px-6 dot-grid-light select-none">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-[32px] p-8 md:p-12 shadow-premium text-center space-y-8 relative z-10">
        
        {/* Spinner icon animation */}
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
            className="w-16 h-16 border-2 border-zinc-100 border-t-zinc-900 rounded-full absolute inset-0"
          />
          <Sparkles className="w-5 h-5 text-zinc-900 absolute z-10" />
        </div>

        {/* Curation status text */}
        <div className="space-y-3">
          <span className="text-[9px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">AI Curation Active</span>
          <h2 className="text-xl font-serif font-black text-zinc-900 tracking-tightest">Analyzing your photos...</h2>
          <p className="text-xs text-zinc-500 font-light max-w-xs mx-auto leading-relaxed">
            {statusMessage}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[9px] font-bold font-geist-mono uppercase text-zinc-400">
            <span>Progress status</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/40">
            <div 
              className="h-full bg-zinc-900 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

export default function FreeTrialProcessing() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    }>
      <TrialProcessingContent />
    </Suspense>
  )
}
