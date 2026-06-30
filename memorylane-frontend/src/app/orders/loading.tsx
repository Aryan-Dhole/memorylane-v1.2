import React from "react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner */}
        <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-geist-mono">
          Loading layout data...
        </p>
      </div>
    </div>
  )
}
