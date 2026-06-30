"use client"

import React, { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Route error boundary triggered:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex items-center justify-center font-sans px-6 relative dot-grid-light">
      <div className="text-center max-w-md relative z-10 space-y-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-250 text-red-600 mb-2">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-serif font-black text-zinc-900 tracking-tightest leading-none">Something went wrong</h1>
        <p className="text-zinc-500 text-sm leading-relaxed font-light">
          An unexpected error occurred while loading this view. You can try rendering this page again.
        </p>
        <div className="pt-4 flex items-center justify-center gap-4">
          <Button 
            onClick={() => reset()}
            className="bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 px-8 rounded-full shadow-lg"
          >
            Try Again
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-xs uppercase tracking-wider font-geist-mono py-5 px-8 rounded-full shadow-md"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
