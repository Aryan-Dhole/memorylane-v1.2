"use client"

import React, { useState, useEffect } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const [isHovered, setIsHovered] = useState(false)

  const cursorSpringX = useSpring(cursorX, { damping: 30, stiffness: 300 })
  const cursorSpringY = useSpring(cursorY, { damping: 30, stiffness: 300 })

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 10)
      cursorY.set(e.clientY - 10)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("button, a, [role='button'], input, textarea, .interactive-hover, [data-hover]")) {
        setIsHovered(true)
      } else {
        setIsHovered(false)
      }
    }

    window.addEventListener("mousemove", moveCursor)
    window.addEventListener("mouseover", handleMouseOver)
    return () => {
      window.removeEventListener("mousemove", moveCursor)
      window.removeEventListener("mouseover", handleMouseOver)
    }
  }, [cursorX, cursorY])

  return (
    <>
      <motion.div
        style={{
          x: cursorSpringX,
          y: cursorSpringY,
          scale: isHovered ? 2.5 : 1,
          backgroundColor: isHovered ? "rgba(139, 92, 246, 0.15)" : "rgba(24, 24, 27, 0.8)",
          borderColor: isHovered ? "rgba(139, 92, 246, 0.6)" : "rgba(255, 255, 255, 0.15)",
          mixBlendMode: isHovered ? "difference" : "normal"
        }}
        className="w-5 h-5 rounded-full border fixed pointer-events-none z-[9999] md:block hidden transition-colors duration-300"
      />
      {children}
    </>
  )
}
