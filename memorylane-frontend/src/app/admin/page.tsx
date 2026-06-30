"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Lock, RefreshCw, DollarSign, Layers, Cpu, AlertTriangle, 
  ExternalLink, Eye, Play, ArrowLeft, Heart, CheckCircle2, ChevronRight
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import Logo from "@/components/logo"

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  
  // Side panel selected order & associated batch info
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [retriggeringPipeline, setRetriggeringPipeline] = useState(false)

  const safeCompare = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault()
    if (safeCompare(passwordInput, "memorylane2026")) {
      setIsAuthenticated(true)
      loadAdminOrders()
    } else {
      alert("Invalid admin access password!")
    }
  }

  const loadAdminOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get("/orders")
      setOrders(res.data || [])
    } catch (err) {
      console.error("Failed to load admin queue:", err)
      alert("Failed to load admin queue details.")
    } finally {
      setLoading(false)
    }
  }

  // Load batch progress details when an order is selected
  const fetchBatchDetails = async (orderId: string) => {
    setLoadingBatch(true)
    setSelectedBatch(null)
    try {
      const { data, error } = await supabase
        .from("photo_batches")
        .select("id, ai_status, ai_progress, pipeline_result")
        .eq("order_id", orderId)
        .maybeSingle()
      
      if (!error && data) {
        setSelectedBatch(data)
      }
    } catch (err) {
      console.error("Failed to fetch batch status:", err)
    } finally {
      setLoadingBatch(false)
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      fetchBatchDetails(selectedOrder.id)
    }
  }, [selectedOrder])

  const handleUpdateOrderStatus = async (status: string) => {
    if (!selectedOrder) return
    setUpdatingStatus(true)
    try {
      await api.put(`/orders/${selectedOrder.id}/status`, { status })
      setOrders((prev) => 
        prev.map((ord) => (ord.id === selectedOrder.id ? { ...ord, status } : ord))
      )
      setSelectedOrder((prev: any) => ({ ...prev, status }))
    } catch (err) {
      console.error("Failed to override status:", err)
      alert("Failed to update status on server.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleRetriggerCuration = async () => {
    if (!selectedBatch) {
      alert("No active photo batch found for this gallery order.")
      return
    }
    setRetriggeringPipeline(true)
    try {
      await api.post(`/analyze/${selectedBatch.id}`)
      alert("AI Curation pipeline successfully re-triggered!")
      fetchBatchDetails(selectedOrder.id)
      loadAdminOrders()
    } catch (err) {
      console.error("Failed to retrigger pipeline:", err)
      alert("Retrigger request failed. Please check backend worker status.")
    } finally {
      setRetriggeringPipeline(false)
    }
  }

  const getRevenueTotal = () => {
    return orders
      .filter((o) => o.status === "paid" || o.status === "processing" || o.status === "ready")
      .reduce((sum, o) => sum + ((o.total_price || 0) / 100), 0)
  }

  const getReadyCount = () => {
    return orders.filter((o) => o.status === "ready").length
  }

  const getProcessingCount = () => {
    return orders.filter((o) => o.status === "processing" || o.status === "paid").length
  }

  const getFailedCount = () => {
    return orders.filter((o) => o.status === "failed").length
  }

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "all") return true
    return o.status === activeTab
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex items-center justify-center px-6 dot-grid-light selection:bg-zinc-900 selection:text-white font-sans">
        <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-[32px] p-8 space-y-6 shadow-premium">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[#c9a96e] mx-auto shadow-sm">
              <Lock className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-2xl font-serif font-black tracking-tightest leading-none text-zinc-900 mt-2">Admin Panel</h2>
            <p className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider font-geist-mono">MemoryLane Operations</p>
          </div>
          
          <form onSubmit={handleAuthenticate} className="space-y-4">
            <Input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              placeholder="Authorization password"
              className="bg-[#fafafa] border-zinc-200 text-xs rounded-2xl h-12 text-center px-4 font-mono focus:border-zinc-400"
            />
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-5 rounded-full shadow-md text-[10px] uppercase tracking-widest font-geist-mono">
                Authenticate
              </Button>
            </motion.div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-36 px-6 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Row */}
        <div className="flex justify-between items-center border-b border-zinc-200/60 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="w-10 h-10 rounded-full border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-55 text-zinc-500 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none text-zinc-900">Control Center</h1>
              <p className="text-xs text-zinc-400 font-light mt-1 font-geist-mono uppercase tracking-wider">Monitor galleries, manage pipelines, track platform health.</p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={loadAdminOrders} className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-650 rounded-full text-[10px] font-bold font-geist-mono uppercase tracking-widest px-5 shadow-sm">
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Refresh Queue
          </Button>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <Card className="bg-white border border-zinc-200 rounded-3xl p-5 flex items-center gap-4 shadow-premium">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700"><DollarSign className="w-5 h-5" /></div>
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest font-geist-mono">Paid Revenue</span>
              <h3 className="text-lg font-black font-geist-mono text-zinc-850">₹{getRevenueTotal().toLocaleString("en-IN")}</h3>
            </div>
          </Card>

          <Card className="bg-white border border-zinc-200 rounded-3xl p-5 flex items-center gap-4 shadow-premium">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700"><Layers className="w-5 h-5" /></div>
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest font-geist-mono">Live Galleries</span>
              <h3 className="text-lg font-black font-geist-mono text-zinc-850">{getReadyCount()}</h3>
            </div>
          </Card>

          <Card className="bg-white border border-zinc-200 rounded-3xl p-5 flex items-center gap-4 shadow-premium">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 animate-pulse"><Cpu className="w-5 h-5" /></div>
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest font-geist-mono">Active Pipeline</span>
              <h3 className="text-lg font-black font-geist-mono text-zinc-850">{getProcessingCount()}</h3>
            </div>
          </Card>

          <Card className="bg-white border border-zinc-200 rounded-3xl p-5 flex items-center gap-4 shadow-premium">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest font-geist-mono">Failed Jobs</span>
              <h3 className="text-lg font-black font-geist-mono text-zinc-850">{getFailedCount()}</h3>
            </div>
          </Card>
        </div>

        {/* List Operations & Selected Panel */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white border border-zinc-200 p-1.5 rounded-2xl shadow-sm overflow-x-auto max-w-full flex">
              {["all", "draft", "paid", "processing", "ready", "failed"].map((tab) => (
                <TabsTrigger key={tab} value={tab} className="capitalize text-[10px] font-bold font-geist-mono tracking-wider px-4 py-2 rounded-xl transition-all">
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Gallery Orders Table */}
            <div className="md:col-span-2 bg-white border border-zinc-200 rounded-[28px] shadow-premium overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2 font-geist-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-800" />
                  <span>Fetching active galleries...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-12 text-center text-zinc-450 text-xs font-geist-mono font-bold uppercase tracking-widest">NO ENTRIES IN THIS STAGE</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-geist-mono">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-[#fafafa] text-zinc-400 font-bold uppercase tracking-widest text-[9px]">
                        <th className="p-4">Reference</th>
                        <th className="p-4">Event Title</th>
                        <th className="p-4">Tier</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Views</th>
                        <th className="p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="p-4 font-mono text-[10px] text-zinc-400 font-bold">[{ord.id.split("-")[0].toUpperCase()}]</td>
                          <td className="p-4">
                            <div className="font-bold text-zinc-800 uppercase">{ord.event_name || ord.book_title || "My Event"}</div>
                            <div className="text-[9.5px] text-zinc-400 lowercase">{ord.event_slug}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase border ${
                              ord.tier?.toLowerCase() === "free" ? "bg-zinc-50 border-zinc-200 text-zinc-500" :
                              ord.tier?.toLowerCase() === "basic" ? "bg-[#c9a96e]/10 border-[#c9a96e]/20 text-[#b0925c]" :
                              "bg-zinc-950 border-zinc-900 text-[#c9a96e]"
                            }`}>
                              {ord.tier || "basic"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase border ${
                              ord.status === "ready" ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
                              ord.status === "processing" ? "bg-indigo-550/10 text-indigo-750" :
                              ord.status === "paid" ? "bg-amber-50 border-amber-100 text-amber-800" :
                              ord.status === "failed" ? "bg-rose-50 border-rose-100 text-rose-800 font-black" :
                              "bg-zinc-100 border-zinc-200 text-zinc-500"
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-zinc-700">{ord.view_count || 0}</td>
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setSelectedOrder(ord)}
                              className="w-6 h-6 text-zinc-400 hover:text-zinc-850 hover:bg-transparent"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sidebar Selected Gallery Inspector */}
            <div className="space-y-6">
              {selectedOrder ? (
                <div className="bg-white border border-zinc-200 rounded-[28px] p-6 space-y-6 shadow-premium">
                  <div className="space-y-1">
                    <span className="text-[9px] text-zinc-400 font-bold font-geist-mono uppercase tracking-widest">Gallery Inspector</span>
                    <h3 className="text-sm font-bold text-zinc-800 uppercase font-geist-mono">{selectedOrder.event_name || selectedOrder.book_title}</h3>
                    <p className="text-[9.5px] text-zinc-400 font-mono">ID: {selectedOrder.id}</p>
                  </div>

                  {/* Quick stats and path info */}
                  <div className="space-y-3 text-[11px] border-t border-b border-zinc-100 py-4 text-zinc-500 leading-relaxed font-geist-mono">
                    <div className="flex justify-between"><span>Slug URL:</span><span className="text-zinc-800 font-bold">/e/{selectedOrder.event_slug}</span></div>
                    <div className="flex justify-between">
                      <span>Live Link:</span>
                      {selectedOrder.status === "ready" ? (
                        <a 
                          href={`/e/${selectedOrder.event_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#b0925c] hover:underline flex items-center gap-1 font-bold"
                        >
                          Open URL <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-350">Not ready</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>Expires:</span>
                      <span className="text-zinc-700">
                        {selectedOrder.expires_at 
                          ? new Date(selectedOrder.expires_at).toLocaleDateString("en-IN")
                          : "Never (Premium)"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between"><span>Views:</span><span className="text-zinc-800 font-bold flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400" /> {selectedOrder.view_count || 0}</span></div>
                  </div>

                  {/* AI Status display */}
                  <div className="space-y-3 border-b border-zinc-100 pb-4">
                    <label className="text-[9px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400 block">AI Curation Pipeline</label>
                    {loadingBatch ? (
                      <div className="text-[10px] font-bold font-geist-mono text-zinc-400 animate-pulse">Loading batch details...</div>
                    ) : selectedBatch ? (
                      <div className="space-y-3 bg-[#fafafa] border border-zinc-200/80 rounded-2xl p-4 font-geist-mono">
                        <div className="flex justify-between text-[10px]">
                          <span>Status:</span>
                          <span className={`font-bold uppercase ${
                            selectedBatch.ai_status === "completed" ? "text-emerald-700" :
                            selectedBatch.ai_status === "failed" ? "text-rose-700 font-black" :
                            "text-indigo-700 animate-pulse"
                          }`}>{selectedBatch.ai_status}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] text-zinc-455">
                            <span>Processing Progress:</span>
                            <span>{selectedBatch.ai_progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                selectedBatch.ai_status === "failed" ? "bg-rose-500" :
                                selectedBatch.ai_status === "completed" ? "bg-emerald-500" :
                                "bg-indigo-550"
                              }`}
                              style={{ width: `${selectedBatch.ai_progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Pipeline failure banner & re-run controls */}
                        {selectedBatch.ai_status === "failed" && (
                          <div className="bg-rose-55/80 border border-rose-100 rounded-xl p-3 text-[10px] text-rose-800 font-light leading-relaxed font-sans">
                            <strong>Job Crashed:</strong> Vision parsing failed. You can re-trigger processing below after checking backend logs.
                          </div>
                        )}

                        <Button 
                          onClick={handleRetriggerCuration}
                          disabled={retriggeringPipeline}
                          className="w-full bg-zinc-950 text-white hover:bg-zinc-900 text-[9px] font-bold uppercase font-geist-mono h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {retriggeringPipeline ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 text-[#c9a96e]" />
                          )}
                          Re-run AI Curation
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-400 bg-zinc-55 border border-zinc-200 border-dashed rounded-2xl p-4 text-center">
                        No active curation batch configured.
                      </div>
                    )}
                  </div>

                  {/* Manual Status Force Override */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400 block">Manual Status Override</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["draft", "paid", "processing", "ready", "failed"].map((st) => (
                        <Button 
                          key={st} 
                          variant={selectedOrder.status === st ? "default" : "outline"}
                          onClick={() => handleUpdateOrderStatus(st)}
                          disabled={updatingStatus}
                          className={`text-[9px] font-bold uppercase py-2 h-8 rounded-xl font-geist-mono ${
                            selectedOrder.status === st ? "bg-zinc-950 text-white hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-50"
                          }`}
                        >
                          {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-[28px] p-8 text-center text-zinc-400 text-[10px] font-bold font-geist-mono uppercase tracking-widest leading-relaxed shadow-premium">
                  Select a reference from the queue list to inspect gallery details & pipelines.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
