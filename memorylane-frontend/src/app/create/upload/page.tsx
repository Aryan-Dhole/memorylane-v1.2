"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  UploadCloud, RefreshCw, CheckCircle,
  ChevronRight, Check, Edit3, ArrowLeft, Loader2,
  Cpu, CheckCircle2
} from "lucide-react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import Logo from "@/components/logo"

const getEmotionEmoji = (emotion?: string) => {
  const e = emotion?.toLowerCase() || "";
  if (e.includes("smile") || e.includes("happy")) return "😊";
  if (e.includes("laugh")) return "😄";
  if (e.includes("surprise")) return "😮";
  if (e.includes("serious") || e.includes("concentrate")) return "😐";
  if (e.includes("sad") || e.includes("cry")) return "😢";
  if (e.includes("angry")) return "😠";
  return "📸";
}

function UploadAndAIFlowContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookType = searchParams.get("type") || "wedding"
  const tier = searchParams.get("tier") || "basic"

  // Event details
  const eventName = searchParams.get("event_name") || "My Event"
  const eventDate = searchParams.get("event_date") || ""
  const eventLocation = searchParams.get("event_location") || ""

  // Wizard step state (0: Upload, 1: AI Processing, 2: Selection Review, 3: Layout Preview, 4: Checkout, 5: Receipt)
  const [currentStep, setCurrentStep] = useState(0)

  // Upload and API states
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [batchId, setBatchId] = useState<string>("")
  const [orderId, setOrderId] = useState<string>("")

  // Polling states
  const [aiProgress, setAiProgress] = useState(0)
  const [aiStatus, setAiStatus] = useState("pending")
  const [statusMessage, setStatusMessage] = useState("Initializing model analyser...")

  // Results
  const [photos, setPhotos] = useState<any[]>([])
  const [selectedPhotoPaths, setSelectedPhotoPaths] = useState<string[]>([])
  const [editingCaptionIdx, setEditingCaptionIdx] = useState<number | null>(null)
  const [editingCaptionText, setEditingCaptionText] = useState("")

  // Checkout Recipient Details
  const [shipping, setShipping] = useState({
    name: "",
    phone: "",
    address1: "Digital Gallery Delivery",
    address2: "",
    city: "Digital",
    state: "Digital",
    pincode: "000000"
  })

  // Prefill contact metadata from authenticated session
  useEffect(() => {
    async function prefillUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setShipping(prev => ({
          ...prev,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || prev.name,
          phone: session.user.phone || prev.phone
        }))
      }
    }
    prefillUser()
  }, [])

  const getUploadLimit = () => {
    switch (tier.toLowerCase()) {
      case "free": return 50
      case "basic": return 500
      case "premium": return 1000
      case "photographer": return 5000
      default: return 50
    }
  }
  const uploadLimit = getUploadLimit()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [] },
    maxFiles: uploadLimit,
    onDrop: (acceptedFiles) => {
      setFiles((prev) => {
        const combined = [...prev, ...acceptedFiles]
        if (combined.length > uploadLimit) {
          alert(`You selected ${combined.length} files. The maximum upload limit for the '${tier}' plan is ${uploadLimit} files. We have trimmed your selection to the first ${uploadLimit} files.`)
          return combined.slice(0, uploadLimit)
        }
        return combined
      })
    }
  })

  const getBasePrice = () => {
    switch (tier.toLowerCase()) {
      case "free": return 0
      case "basic": return 499
      case "premium": return 999
      default: return 499
    }
  }
  const basePrice = getBasePrice()
  const orderTotal = basePrice

  // 1. Initialise order and uploads
  const handleStartUpload = async () => {
    if (files.length === 0) return
    setIsUploading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const orderRes = await api.post("/orders", {
        book_type: bookType,
        tier: tier,
        event_name: eventName,
        event_date: eventDate,
        event_location: eventLocation,
        total_price: orderTotal * 100
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const createdOrder = orderRes.data
      setOrderId(createdOrder.id)

      const initRes = await api.post("/upload/init", {
        order_id: createdOrder.id,
        file_count: files.length,
        event_type: bookType
      })
      const { batch_id, upload_urls } = initRes.data
      setBatchId(batch_id)

      const uploadedKeys: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const urlItem = upload_urls[i]

        await fetch(urlItem.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "image/jpeg" }
        })

        uploadedKeys.push(urlItem.s3_key)
        setUploadProgress(Math.round(((i + 1) / files.length) * 100))
      }

      await api.post("/upload/confirm", {
        batch_id: batch_id,
        uploaded_keys: uploadedKeys
      })

      await api.post(`/analyze/${batch_id}`, {
        book_size: "medium",
        caption_style: "cinematic",
        language: "English"
      })

      setIsUploading(false)
      setCurrentStep(1)

    } catch (error: any) {
      console.error("Upload workflow failed:", error)
      setIsUploading(false)
      if (process.env.NODE_ENV === "development") {
        setBatchId("mock_batch_id")
        setCurrentStep(1)
      } else {
        alert("Upload workflow failed. Please check your network connection and try again.")
      }
    }
  }

  // 2. Poll AI status
  useEffect(() => {
    if (currentStep !== 1 || !batchId) return

    let intervalId = setInterval(async () => {
      try {
        const statusRes = await api.get(`/analyze/status/${batchId}`)
        const data = statusRes.data
        setAiProgress(data.progress)
        setAiStatus(data.status)

        if (data.progress < 25) {
          setStatusMessage("Evaluating photo resolutions & blur properties...")
        } else if (data.progress < 50) {
          setStatusMessage("Analyzing face landmarks, clusters & emotional expressions...")
        } else if (data.progress < 75) {
          setStatusMessage("Sorting moments chronologically and grouping visual stories...")
        } else if (data.progress < 100) {
          setStatusMessage("Running AI caption passes and preparing layout coordinates...")
        } else {
          setStatusMessage("Finalizing visual gallery. Complete!")
        }

        if (data.status === "completed" || data.progress >= 100) {
          clearInterval(intervalId)
          const res = await api.get(`/analyze/result/${batchId}`)
          setPhotos(res.data.selected_photos)
          setSelectedPhotoPaths(res.data.selected_photos.map((p: any) => p.path))
          setCurrentStep(2)
        }
      } catch (err) {
        console.error("Polling AI status failed:", err)
        if (process.env.NODE_ENV === "development") {
          setAiProgress((prev) => {
            if (prev >= 100) {
              clearInterval(intervalId)
              api.get(`/analyze/result/mock`).then(res => {
                setPhotos(res.data.selected_photos)
                setSelectedPhotoPaths(res.data.selected_photos.map((p: any) => p.path))
                setCurrentStep(2)
              })
              return 100
            }
            return prev + 20
          })
        } else {
          clearInterval(intervalId)
          alert("We encountered an issue curating your photos. Please retry or contact support.")
        }
      }
    }, 2500)

    return () => clearInterval(intervalId)
  }, [currentStep, batchId])

  const togglePhotoSelection = (path: string) => {
    setSelectedPhotoPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const filteredPhotos = photos.filter((p) => selectedPhotoPaths.includes(p.path))

  const saveCaptionEdit = (idx: number) => {
    const updated = [...photos]
    updated[idx].caption = editingCaptionText
    setPhotos(updated)
    setEditingCaptionIdx(null)
  }

  const handleCheckoutPayment = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Update recipient contact info
      await api.put(`/orders/${orderId}/shipping`, {
        shipping_name: shipping.name,
        shipping_address: shipping.address1,
        shipping_city: shipping.city,
        shipping_pincode: shipping.pincode,
        shipping_phone: shipping.phone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Bypass Razorpay gateway if tier is Free
      if (tier.toLowerCase() === "free") {
        await api.post("/payments/free-checkout", {
          order_id: orderId
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setCurrentStep(5)
        return
      }

      const payRes = await api.post("/payments/create-order", {
        order_id: orderId
      })
      const rzpOrderId = payRes.data.razorpay_order_id

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkey",
        amount: payRes.data.amount,
        currency: "INR",
        order_id: rzpOrderId,
        name: "MemoryLane",
        description: `${eventName} Gallery Edition`,
        handler: async (response: any) => {
          try {
            await api.post("/payments/verify", response)
            setCurrentStep(5)
          } catch (e) {
            setCurrentStep(5)
          }
        },
        prefill: {
          name: shipping.name,
          contact: shipping.phone,
          email: session?.user?.email || "customer@example.com"
        },
        theme: { color: "#18181b" }
      }

      if (typeof (window as any).Razorpay === "undefined") {
        await api.post("/payments/verify", {
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: "pay_mock_id",
          razorpay_signature: "mock_signature"
        })
        setCurrentStep(5)
        return
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()

    } catch (err) {
      console.error("Checkout process failed:", err)
      setCurrentStep(5)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-40 px-4 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      <div className="max-w-5xl mx-auto relative z-10">

        {/* Exit back navigation */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-8 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Exit to Dashboard</span>
        </Link>

        {/* Step Header Navigation Timeline */}
        <div className="flex justify-between items-center mb-16 overflow-x-auto pb-4 gap-6 text-[10px] font-bold font-geist-mono uppercase tracking-widest border-b border-zinc-200/60 scrollbar-none">
          {[
            { step: 0, label: "Upload" },
            { step: 1, label: "Curation" },
            { step: 2, label: "Review" },
            { step: 3, label: "Preview" },
            { step: 4, label: "Checkout" },
            { step: 5, label: "Receipt" }
          ].map((st) => (
            <div
              key={st.step}
              className={`flex items-center gap-1.5 shrink-0 ${currentStep === st.step ? "text-zinc-900 font-black border-b border-zinc-900 pb-3 -mb-4.5" : "text-zinc-400"
                }`}
            >
              <span>{st.label}</span>
              {currentStep > st.step && <Check className="w-3 h-3 text-zinc-900" />}
            </div>
          ))}
        </div>

        {/* STEP 0: PHOTO UPLOAD */}
        {currentStep === 0 && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <h2 className="text-3xl font-serif font-black tracking-tightest leading-none text-zinc-900">Upload Files</h2>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${isDragActive ? "border-zinc-900 bg-zinc-100" : "border-zinc-200 bg-white hover:border-zinc-400 shadow-premium"
                  }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
                <h4 className="text-xs font-bold font-geist-mono uppercase tracking-wider text-zinc-800 mb-1">Drag and drop images</h4>
                <p className="text-zinc-400 text-[10px] mb-4 font-light">
                  {tier.toLowerCase() === "free" && "Free plan limit: Upload up to 50 photos (AI will select the best 20)."}
                  {tier.toLowerCase() === "basic" && "Basic plan limit: Upload up to 500 photos (AI will select the best 80)."}
                  {tier.toLowerCase() === "premium" && "Premium plan limit: Upload up to 2000 photos (AI will select the best 200)."}
                  {tier.toLowerCase() === "photographer" && "Photographer plan limit: Upload up to 5000 photos (AI will select the best 500)."}
                  {!["free", "basic", "premium", "photographer"].includes(tier.toLowerCase()) && "Supports JPEG & PNG. Maximum 500 files."}
                </p>
                <Button variant="outline" className="text-[10px] font-bold font-geist-mono uppercase rounded-full border-zinc-200 hover:bg-zinc-50 px-6">
                  Select Files
                </Button>
              </div>

              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">
                    <span>{files.length} Files Selected</span>
                    <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-zinc-400 hover:text-zinc-800 p-0 h-auto font-geist-mono text-[9px]">
                      Clear list
                    </Button>
                  </div>
                  <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto p-3 bg-white border border-zinc-200 rounded-3xl shadow-premium">
                    {files.map((file, idx) => (
                      <div key={idx} className="aspect-square bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar details */}
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-6 shadow-premium">
                <h3 className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-800 border-b border-zinc-100 pb-3">Gallery Summary</h3>
                <div className="space-y-3 text-xs text-zinc-500 border-b border-zinc-100 pb-4">
                  <div className="flex justify-between"><span>Event name:</span><span className="text-zinc-800 font-bold uppercase truncate max-w-[120px]">{eventName}</span></div>
                  <div className="flex justify-between"><span>Event theme:</span><span className="text-zinc-800 font-bold uppercase font-geist-mono">{bookType}</span></div>
                  <div className="flex justify-between"><span>Gallery tier:</span><span className="text-zinc-800 font-bold uppercase font-geist-mono">{tier}</span></div>
                </div>
                <div className="flex justify-between items-center text-zinc-800">
                  <span className="text-xs font-bold font-geist-mono uppercase text-zinc-400">Total Price:</span>
                  <span className="text-lg font-black font-geist-mono">{orderTotal === 0 ? "FREE" : `₹${orderTotal}`}</span>
                </div>

                {isUploading ? (
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between text-[10px] font-bold font-geist-mono text-zinc-500">
                      <span>Uploading to S3...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-900 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleStartUpload}
                      disabled={files.length === 0}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-lg"
                    >
                      Start AI Design
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}        {/* STEP 1: AI PROCESSING */}
        {currentStep === 1 && (() => {
          const stages = [
            { id: 1, label: "Quality Scorer & Resolution Check", minProgress: 0, maxProgress: 25 },
            { id: 2, label: "Duplicate & Blur Removal Pass", minProgress: 25, maxProgress: 50 },
            { id: 3, label: "Identity Face Clustering & Emotion Mapping", minProgress: 50, maxProgress: 75 },
            { id: 4, label: "Chrono Moment Sequencing", minProgress: 75, maxProgress: 90 },
            { id: 5, label: "Claude Vision Caption Pass & Cover Selection", minProgress: 90, maxProgress: 100 },
          ]

          return (
            <div className="max-w-xl mx-auto py-16 px-8 bg-white border border-zinc-200 rounded-[32px] shadow-premium space-y-8 font-sans">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#0a0a0f] border border-zinc-955 flex items-center justify-center text-[#c9a96e] mx-auto relative shadow-sm">
                  <div className="absolute inset-0 rounded-full bg-[#c9a96e]/10 animate-ping pointer-events-none" />
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-2xl font-serif font-black tracking-tightest leading-none text-zinc-900 mt-3">Compiling Interactive Gallery</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-geist-mono">MemoryLane AI Pipeline</p>
              </div>

              {/* Pipeline Tasks list */}
              <div className="border-y border-zinc-100 py-6 space-y-4 font-geist-mono">
                {stages.map((stage) => {
                  const isDone = aiProgress >= stage.maxProgress
                  const isActive = aiProgress >= stage.minProgress && aiProgress < stage.maxProgress

                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center gap-3.5 transition-all duration-300 ${isDone ? "text-zinc-800 font-medium" :
                          isActive ? "text-zinc-900 font-bold" :
                            "text-zinc-350 font-light"
                        }`}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-zinc-800" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-[#c9a96e] animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-zinc-200 bg-[#fafafa]" />
                        )}
                      </div>
                      <span className="text-xs tracking-tight">{stage.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Progress status bar */}
              <div className="space-y-3 max-w-sm mx-auto pt-2">
                <div className="flex justify-between items-center text-[10px] font-bold font-geist-mono text-zinc-400">
                  <span className="uppercase tracking-widest">STATUS: {statusMessage}</span>
                  <span>{aiProgress}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 transition-all duration-500 rounded-full"
                    style={{ width: `${aiProgress}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 font-geist-mono uppercase text-center tracking-wider pt-2">
                  Estimated duration: ~ 5 to 15 minutes for this sandbox compilation
                </p>
              </div>
            </div>
          )
        })()}

        {/* STEP 2: REVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h2 className="text-3xl font-serif font-black tracking-tightest text-zinc-900">Review Curations</h2>
                <p className="text-zinc-500 text-xs mt-1">Our AI evaluated photographic metrics. Unselect items you wish to omit.</p>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={() => setCurrentStep(3)} className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono rounded-full px-6 shadow-md">
                  Next: Flow Preview
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {photos.map((photo, idx) => {
                const isSelected = selectedPhotoPaths.includes(photo.path)
                return (
                  <div
                    key={idx}
                    onClick={() => togglePhotoSelection(photo.path)}
                    className={`aspect-square bg-white border cursor-pointer relative overflow-hidden transition-all duration-300 rounded-2xl shadow-sm ${isSelected ? "border-zinc-900 ring-1 ring-zinc-900 scale-[0.98]" : "border-zinc-200 opacity-40 scale-[0.96]"
                      }`}
                  >
                    <div className="relative w-full h-full">
                      <img
                        src={photo.path}
                        alt="curated img"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1 items-center">
                      <div className="bg-white/95 text-[9px] font-bold font-geist-mono uppercase text-zinc-700 px-2.5 py-1 border border-zinc-250 rounded-xl shadow-premium flex items-center gap-1.5">
                        <span>{getEmotionEmoji(photo.dominant_emotion)}</span>
                        <span>{photo.scene}</span>
                      </div>
                    </div>
                    <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white/80 border-zinc-200 text-transparent"
                      }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h2 className="text-3xl font-serif font-black tracking-tightest text-zinc-900">Cinematic Preview</h2>
                <p className="text-zinc-500 text-xs mt-1">Review the vertical scroll flow. Hover over any text block and click edit to customize captions.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => setCurrentStep(4)} className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono rounded-full px-6 shadow-md">
                  Proceed to Checkout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-[32px] p-6 md:p-8 shadow-premium max-w-2xl mx-auto space-y-12 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
              {filteredPhotos.map((photo, i) => (
                <div key={i} className="space-y-4 flex flex-col items-center border-b border-zinc-100 pb-8 last:border-b-0 last:pb-0">
                  <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-zinc-150 shadow-md">
                    <img
                      src={photo.path}
                      alt="Preview photo"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {editingCaptionIdx === i ? (
                    <div className="flex items-center gap-2 w-full max-w-md">
                      <Input
                        value={editingCaptionText}
                        onChange={(e) => setEditingCaptionText(e.target.value)}
                        className="h-9 bg-white border-zinc-200 text-xs rounded-xl"
                      />
                      <Button size="sm" onClick={() => saveCaptionEdit(i)} className="h-9 bg-zinc-900 text-white font-bold uppercase text-[9px] font-geist-mono rounded-xl px-4">Save</Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-center gap-2 group max-w-md w-full text-center">
                      <p className="text-xs text-zinc-650 italic leading-relaxed">
                        "{photo.caption || "A beautiful moment captured."}"
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCaptionIdx(i)
                          setEditingCaptionText(photo.caption || "")
                        }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 text-zinc-400 hover:text-zinc-800 hover:bg-transparent shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: CHECKOUT */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-zinc-200 pb-5">
              <h2 className="text-3xl font-serif font-black text-zinc-900 tracking-tightest leading-none">Checkout Details</h2>
              <p className="text-zinc-500 text-xs mt-1">Specify recipient name and contact details. Gallery URL will be dispatched here.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6 bg-white border border-[#eaeaea] p-8 rounded-3xl shadow-premium">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Recipient Name</label>
                    <Input
                      value={shipping.name}
                      onChange={(e) => setShipping(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Receiver's name"
                      className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Phone Number (Updates)</label>
                    <Input
                      value={shipping.phone}
                      onChange={(e) => setShipping(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91..."
                      className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4"
                    />
                  </div>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl">
                  <span className="block text-[9px] font-bold font-geist-mono uppercase text-[#c9a96e] mb-1">Method of Delivery</span>
                  <span className="text-xs text-zinc-800 font-medium">100% Instant Digital Delivery</span>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed font-light">Your private event gallery is sent to your registered email address and updated via Twilio WhatsApp alerts once curation completes.</p>
                </div>
              </div>

              {/* Sidebar review & pay */}
              <div>
                <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-6 shadow-premium">
                  <h3 className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-800 border-b border-zinc-100 pb-3">Checkout</h3>
                  <div className="space-y-2 text-xs text-zinc-500 border-b border-zinc-100 pb-4 font-geist-mono">
                    <div className="flex justify-between"><span>Base package ({tier}):</span><span>{orderTotal === 0 ? "FREE" : `₹${orderTotal}`}</span></div>
                    <div className="flex justify-between text-zinc-800 font-bold border-t border-zinc-100 pt-3 mt-1"><span>Total charge:</span><span>{orderTotal === 0 ? "FREE" : `₹${orderTotal}`}</span></div>
                  </div>

                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleCheckoutPayment}
                      disabled={!shipping.name || !shipping.phone}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-lg"
                    >
                      {orderTotal === 0 ? "Confirm & Build Gallery" : "Pay via Razorpay"}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: RECEIPT */}
        {currentStep === 5 && (
          <div className="max-w-md mx-auto text-center py-16 bg-white border border-zinc-200 rounded-3xl p-8 shadow-premium space-y-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle className="w-5 h-5" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-serif font-black text-zinc-900 tracking-tightest leading-none">Curation Initiated</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed font-light">
                Your order is confirmed. The AI pipeline is curating files and generating face clusters. We will email/WhatsApp you once live!
              </p>
            </div>

            <div className="bg-[#fafafa] border border-zinc-200 p-5 rounded-2xl text-left space-y-3 text-[11px] text-zinc-500 font-geist-mono">
              <div className="flex justify-between"><span>TRACKER REF:</span><span className="font-mono text-zinc-850 font-bold uppercase">{orderId.split("-")[0] || "ML-9428"}</span></div>
              <div className="flex justify-between"><span>EST TIMELINE:</span><span className="text-zinc-850 font-bold">Ready in ~15 minutes</span></div>
              <div className="flex justify-between"><span>RECIPIENT:</span><span className="text-zinc-850 font-bold uppercase">{shipping.name}</span></div>
            </div>

            <div className="pt-4 flex flex-col gap-3 max-w-xs mx-auto">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={() => router.push(`/dashboard`)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-md">
                  Go to Dashboard
                </Button>
              </motion.div>
              <Button variant="ghost" onClick={() => router.push("/")} className="w-full text-zinc-400 hover:text-zinc-700 text-xs font-bold uppercase font-geist-mono">
                Return to Home
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

import { Suspense } from "react"

export default function UploadAndAIFlow() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" />
        <span className="text-zinc-400 text-xs font-bold font-geist-mono uppercase tracking-widest animate-pulse ml-2">Loading design workspace...</span>
      </div>
    }>
      <UploadAndAIFlowContent />
    </Suspense>
  )
}
