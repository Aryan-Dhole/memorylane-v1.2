"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Download, Eye, Link2, Check, MessageCircle, FileText, Archive } from "lucide-react"
import { api } from "@/lib/api"
import Confetti from "@/components/ui/Confetti"

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderReadyCelebration({ params }: PageProps) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)

  // 1. Fetch order details
  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await api.get(`/orders/${orderId}`)
        setOrder(res.data)
      } catch (err) {
        console.error("Failed to load order for ready celebration:", err)
      } finally {
        setLoading(false)
      }
    }
    loadOrder()
  }, [orderId])

  const shareUrl = typeof window !== "undefined" && order?.share_token
    ? `${window.location.origin}/book/${order.share_token}`
    : ""

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const res = await api.get(`/books/download/pdf/${orderId}`)
      if (res.data?.url) {
        window.open(res.data.url, "_blank")
      }
    } catch (err) {
      console.error("Failed to trigger PDF download:", err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadZip = async () => {
    setDownloadingZip(true)
    try {
      const res = await api.get(`/books/download/zip/${orderId}`)
      if (res.data?.url) {
        window.open(res.data.url, "_blank")
      }
    } catch (err) {
      console.error("Failed to trigger ZIP download:", err)
    } finally {
      setDownloadingZip(false)
    }
  }

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=Check%20out%20my%20MemoryLane%20photo%20book!%20${encodeURIComponent(shareUrl)}`
    : ""

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#faf9f7] flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-[#c9a96e] border-zinc-900 animate-spin mx-auto" />
          <p className="text-zinc-500 text-[10px] font-bold font-mono tracking-widest uppercase">Preparing Celebration Screen...</p>
        </div>
      </div>
    )
  }

  const isPro = order?.tier?.toLowerCase() === "pro"

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#faf9f7] font-sans py-32 px-6 relative overflow-hidden select-none">
      
      {/* 1. Interactive Confetti Launcher */}
      <Confetti />

      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#c9a96e]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#c9a96e]/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10 space-y-12">
        
        {/* Navigation & Brand Header */}
        <div className="flex justify-between items-center">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#faf9f7] text-[10px] font-bold font-mono uppercase tracking-widest transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          <span className="text-[#c9a96e] font-serif italic text-lg font-bold">MemoryLane</span>
        </div>

        {/* Celebration Title Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-16 h-16 bg-[#c9a96e]/10 border border-[#c9a96e]/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <span className="text-3xl">🎉</span>
          </motion.div>
          
          <h1 className="text-3xl md:text-5xl font-serif font-black tracking-tightest leading-none">
            Your Book is Ready!
          </h1>
          <p className="text-xs md:text-sm font-light text-[#a89f94] max-w-md mx-auto leading-relaxed">
            Your custom-curated digital photo book, narrative chapters, and high-res files are compiled and ready.
          </p>
        </div>

        {/* Cinematic Preview / Hero Call To Action */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 1.0 }}
          className="bg-[#121217] border border-zinc-900 rounded-[32px] p-8 md:p-10 shadow-premium-dark text-center space-y-8"
        >
          <div className="space-y-2">
            <span className="text-[10px] text-[#c9a96e] font-bold font-mono uppercase tracking-widest">
              Digital Experience
            </span>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-[#faf9f7]">
              {order?.book_title || "My Memory Book"}
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
              {order?.tier} Edition • {order?.page_count || 30} Story Pages Curated
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {order?.share_token && (
              <Link
                href={`/book/${order.share_token}`}
                target="_blank"
                className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 bg-[#faf9f7] text-[#0a0a0f] hover:bg-[#c9a96e] hover:text-[#0a0a0f] font-bold font-mono text-[10px] uppercase tracking-wider py-4.5 px-6 rounded-full shadow-md transition-all group"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Shareable Book</span>
              </Link>
            )}
            
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 bg-[#181822] border border-zinc-800 text-[#faf9f7] hover:border-zinc-500 font-bold font-mono text-[10px] uppercase tracking-wider py-4.5 px-6 rounded-full shadow-lg transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-[#c9a96e]" />
                  <span>Copy Share Link</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Download Asset Grid Cards */}
        <div className="grid sm:grid-cols-2 gap-6">
          
          {/* PDF Download Card */}
          <div className="bg-[#121217] border border-zinc-900 rounded-[24px] p-6 space-y-6 flex flex-col justify-between shadow-premium-dark">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[#1c1c24] flex items-center justify-center text-[#c9a96e]">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-[#faf9f7] text-base">Print Quality PDF</h3>
              <p className="text-[11px] text-[#a89f94] font-light leading-relaxed">
                Archival quality 300 DPI layout file, formatted in landscape spreads. Perfect for viewing or local printing.
              </p>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="w-full flex items-center justify-center gap-2 bg-[#1c1c24] border border-zinc-800 text-[#faf9f7] hover:border-zinc-600 font-mono text-[10px] uppercase tracking-widest py-3 px-4 rounded-full transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? "Requesting PDF..." : "Download PDF"}</span>
            </button>
          </div>

          {/* ZIP Archive Card (Disabled/Inactive for Starter & Classic) */}
          <div className={`bg-[#121217] border border-zinc-900 rounded-[24px] p-6 space-y-6 flex flex-col justify-between shadow-premium-dark ${!isPro ? "opacity-40" : ""}`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[#1c1c24] flex items-center justify-center text-[#c9a96e]">
                <Archive className="w-5 h-5" />
              </div>
              <div className="flex justify-between items-center">
                <h3 className="font-serif font-bold text-[#faf9f7] text-base">Photos Archive (.ZIP)</h3>
                {!isPro && (
                  <span className="text-[8px] bg-[#c9a96e]/10 text-[#c9a96e] border border-[#c9a96e]/20 px-2 py-0.5 rounded font-mono uppercase tracking-widest font-bold">
                    Pro Tier
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#a89f94] font-light leading-relaxed">
                Includes all original-quality photo assets, slugified and numbered according to the narrative timeline sequence.
              </p>
            </div>

            {isPro ? (
              <button
                onClick={handleDownloadZip}
                disabled={downloadingZip}
                className="w-full flex items-center justify-center gap-2 bg-[#1c1c24] border border-zinc-800 text-[#faf9f7] hover:border-zinc-600 font-mono text-[10px] uppercase tracking-widest py-3 px-4 rounded-full transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingZip ? "Requesting ZIP..." : "Download Photos ZIP"}</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 bg-[#121217] border border-zinc-950 text-zinc-600 font-mono text-[10px] uppercase tracking-widest py-3 px-4 rounded-full cursor-not-allowed"
              >
                <span>Upgrade to Pro to download</span>
              </button>
            )}
          </div>

        </div>

        {/* Quick Social Shares */}
        {shareUrl && (
          <div className="border-t border-zinc-900 pt-8 flex flex-col items-center gap-4 text-center">
            <span className="text-[9px] text-zinc-500 font-bold font-mono uppercase tracking-widest">Share Album With Friends & Family</span>
            <div className="flex gap-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-[#121217] border border-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#25D366] hover:border-[#25D366]/40 transition-colors"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
