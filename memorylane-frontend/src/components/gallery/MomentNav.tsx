"use client"

import React from "react"

interface Moment {
  id: string;
  name: string;
}

interface MomentNavProps {
  moments: Moment[];
  activeMoment: string | null;
  onSelectMoment: (momentId: string) => void;
}

export default function MomentNav({ moments, activeMoment, onSelectMoment }: MomentNavProps) {
  return (
    <div className="w-full bg-zinc-950 border-b border-zinc-900 overflow-x-auto select-none py-3 px-6 md:px-12 scrollbar-none sticky top-[88px] z-30 bg-opacity-95">
      <div className="max-w-6xl mx-auto flex items-center gap-6 md:justify-center">
        {moments.map((moment) => {
          const isActive = activeMoment === moment.id
          return (
            <button
              key={moment.id}
              onClick={() => onSelectMoment(moment.id)}
              className={`text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-300 py-1 whitespace-nowrap focus:outline-none relative ${
                isActive ? "text-[#c9a96e]" : "text-zinc-400 hover:text-white"
              }`}
            >
              {moment.name}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c9a96e]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
