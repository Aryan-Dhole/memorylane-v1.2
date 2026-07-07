"use client"

import React from "react"

export function PhotoUnavailable({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center bg-zinc-900/65 border border-zinc-850 text-zinc-500 select-none ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span className="text-[9px] mt-2 font-mono uppercase tracking-wider text-zinc-500">Photo unavailable</span>
    </div>
  )
}
