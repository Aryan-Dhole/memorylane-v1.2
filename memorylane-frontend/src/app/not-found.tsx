"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex items-center justify-center font-sans px-6 relative dot-grid-light">
      <div className="text-center max-w-md relative z-10 space-y-6">
        <h1 className="text-9xl font-serif font-black text-zinc-900 tracking-tightest leading-none">404</h1>
        <h2 className="text-xl font-bold uppercase tracking-wider text-zinc-800 font-geist-mono">Page Not Found</h2>
        <p className="text-zinc-500 text-sm leading-relaxed font-light">
          The memory layout or dashboard route you are trying to access does not exist or has been archived.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button className="bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 px-8 rounded-full shadow-lg group">
              <ArrowLeft className="w-3.5 h-3.5 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
