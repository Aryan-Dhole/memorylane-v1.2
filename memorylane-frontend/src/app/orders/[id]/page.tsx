"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Clock, Mail, CheckCircle2, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { api } from "@/lib/api"

const TIMELINE_STEPS = [
  { status: "draft", label: "Order Created", desc: "Digital layout configured, awaiting secure payment clearance." },
  { status: "paid", label: "Payment Confirmed", desc: "Payment cleared. Initializing AI curation queue." },
  { status: "processing", label: "AI Curation & Layouts", desc: "Curation algorithm active (sequence narrative, duplicates cleanup, caption drafting)." },
  { status: "ready", label: "Book Compilation Ready", desc: "High-resolution PDF generated and scroll-animated shareable book completed." }
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default function OrderTracking({ params }: PageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const orderId = resolvedParams.id
  
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await api.get(`/orders/${orderId}`)
        setOrder(res.data)
      } catch (err: any) {
        console.error("Failed to load order:", err)
        if (process.env.NODE_ENV === "development") {
          setOrder({
            id: orderId,
            status: "processing",
            book_type: "wedding",
            tier: "classic",
            total_price: 59900,
            shipping_name: "Customer",
            shipping_address: "Digital Delivery",
            shipping_city: "Digital",
            shipping_pincode: "000000",
            shipping_phone: "",
            book_title: "My Memory Book"
          })
        } else {
          alert("Failed to locate order. Please check the URL or contact support.")
        }
      } finally {
        setLoading(false)
      }
    }
    loadOrder()
  }, [orderId])

  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          setOrder(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  useEffect(() => {
    if (order?.status === "ready") {
      router.push(`/orders/${orderId}/ready`)
    }
  }, [order?.status, orderId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex items-center justify-center dot-grid-light">
        <div className="text-center space-y-4">
          <Clock className="w-8 h-8 text-zinc-800 animate-spin mx-auto" />
          <p className="text-zinc-400 text-xs font-bold font-geist-mono uppercase tracking-widest">CONNECTING TO TRACKER LOGS...</p>
        </div>
      </div>
    )
  }

  const currentStatusIndex = TIMELINE_STEPS.findIndex((s) => s.status === order?.status)
  const isPro = order?.tier?.toLowerCase() === "pro"
  const etaText = isPro ? "Ready in ~15 minutes" : "Ready in ~60 minutes"

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-40 px-6 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-zinc-200/20 blur-[150px] pointer-events-none" />
      
      <div className="max-w-2xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-16 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10 bg-white border border-zinc-200 p-6 rounded-3xl shadow-premium">
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-400 font-bold font-geist-mono uppercase tracking-widest">ORDER ID / {order?.id?.split("-")[0]?.toUpperCase() || "DEMO"}</span>
            <h1 className="text-2xl font-serif font-black tracking-tightest leading-none text-zinc-900 mt-1">
              {order?.book_title || "Preserving memories"}
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold font-geist-mono uppercase mt-0.5">{order?.tier} Edition • ₹{order?.total_price ? order.total_price / 100 : 599}</p>
          </div>
          <div className="bg-[#fafafa] border border-zinc-200 text-zinc-700 text-[10px] font-bold font-geist-mono uppercase px-4 py-2.5 rounded-full flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#c9a96e]" />
            <span>{etaText}</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-premium">
          <h3 className="text-xs font-bold uppercase tracking-widest font-geist-mono text-zinc-800 border-b border-zinc-100 pb-4 mb-6">Compilation Timeline</h3>
          <div className="relative border-l border-zinc-200 ml-3 pl-8 space-y-8">
            {TIMELINE_STEPS.map((step, idx) => {
              const isPast = idx < currentStatusIndex
              const isCurrent = idx === currentStatusIndex
              const isFuture = idx > currentStatusIndex
              return (
                <div key={step.status} className="relative">
                  <div className={`absolute left-[-40px] top-1 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isPast ? "bg-zinc-900 border-zinc-900 text-white" : ""} ${isCurrent ? "bg-zinc-900 border-zinc-900 text-white shadow-lg animate-pulse" : ""} ${isFuture ? "bg-white border-zinc-200 text-transparent" : ""}`}>
                    {isPast && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                    {isFuture && <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />}
                  </div>
                  <div className="space-y-1">
                    <h4 className={`text-xs font-bold uppercase tracking-wide font-geist-mono ${isPast ? "text-zinc-400" : ""} ${isCurrent ? "text-zinc-900" : ""} ${isFuture ? "text-zinc-350" : ""}`}>
                      {step.label}
                    </h4>
                    <p className={`text-[11px] leading-relaxed max-w-md font-light ${isFuture ? "text-zinc-350" : "text-zinc-550"}`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-6">
          <Card className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-premium flex gap-4 items-start">
            <div className="w-10 h-10 rounded-2xl bg-[#fafafa] border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-500">
              <Mail className="w-4 h-4 text-[#c9a96e]" />
            </div>
            <div className="space-y-1 text-[11px] leading-relaxed">
              <h4 className="font-bold text-zinc-800 font-geist-mono uppercase tracking-wider">Email Delivery</h4>
              <p className="text-zinc-450 font-light">All asset download files and shareable book links will be dispatched directly to your authenticated email.</p>
            </div>
          </Card>
          <Card className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-premium flex gap-4 items-start">
            <div className="w-10 h-10 rounded-2xl bg-[#fafafa] border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-[#c9a96e]" />
            </div>
            <div className="space-y-1 text-[11px] leading-relaxed">
              <h4 className="font-bold text-zinc-800 font-geist-mono uppercase tracking-wider">Private & Secure</h4>
              <p className="text-zinc-450 font-light">Only owners hold download authorizations. Your public share links never expire and can be disabled upon request.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
