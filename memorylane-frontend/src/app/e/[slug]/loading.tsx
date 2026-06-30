import React from "react"
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="w-full h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 text-center font-sans select-none">
      <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Unlocking Cinematic Gallery...</span>
    </div>
  )
}
