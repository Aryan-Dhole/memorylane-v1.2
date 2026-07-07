import React from "react"

export function PhotoUnavailable({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center bg-zinc-900 text-zinc-550 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span className="text-xs mt-2 font-geist-mono uppercase tracking-widest text-[9px] font-bold">Photo unavailable</span>
    </div>
  )
}

export default PhotoUnavailable
