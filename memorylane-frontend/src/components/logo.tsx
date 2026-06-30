import React from "react"
import { motion } from "framer-motion"

export default function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        {/* Sleek Dark Chrome/Titanium Gradient for Light Background */}
        <linearGradient id="titaniumGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#18181b" stopOpacity="1" />
          <stop offset="50%" stopColor="#71717a" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e4e4e7" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
      </defs>

      {/* Rotating outer ring */}
      <motion.circle 
        cx="50" 
        cy="50" 
        r="44" 
        stroke="url(#titaniumGlow)" 
        strokeWidth="4.5"
        strokeDasharray="50 30 15 65"
        strokeLinecap="round"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ 
          duration: 16, 
          ease: "linear", 
          repeat: Infinity 
        }}
      />
      
      {/* Dashed secondary indicator ring */}
      <circle cx="50" cy="50" r="32" stroke="#d4d4d8" strokeWidth="1" strokeDasharray="3 3" />

      {/* Central Solid Core */}
      <circle cx="50" cy="50" r="10" fill="url(#coreGlow)" />
      
      {/* Precision crosshair pointers */}
      <line x1="50" y1="12" x2="50" y2="20" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="80" x2="50" y2="88" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="50" x2="20" y2="50" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="80" y1="50" x2="88" y2="50" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
