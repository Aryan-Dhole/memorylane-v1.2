"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, AlertCircle } from "lucide-react"

interface StateWrapperProps {
  isLoading: boolean
  error?: string | null
  loadingMessage?: string
  children: React.ReactNode
}

export function StateWrapper({
  isLoading,
  error = null,
  loadingMessage = "Retrieving database state...",
  children
}: StateWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3"
        >
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <p className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">
            {loadingMessage}
          </p>
        </motion.div>
      ) : error ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4 max-w-sm mx-auto text-center"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest font-geist-mono">Operation failed</h4>
            <p className="text-xs text-zinc-500 font-light leading-relaxed">{error}</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
