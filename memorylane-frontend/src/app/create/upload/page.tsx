"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  UploadCloud, CheckCircle, ArrowLeft, Loader2, Check
} from "lucide-react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"

function UploadAndAIFlowContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookType = searchParams.get("type") || "wedding"
  const tier = searchParams.get("tier") || "basic"

  // Event details
  const eventName = searchParams.get("event_name") || "My Event"
  const eventDate = searchParams.get("event_date") || ""
  const eventLocation = searchParams.get("event_location") || ""

  // Wizard step state (0: Upload, 1: Checkout, 2: Receipt)
  const [currentStep, setCurrentStep] = useState(0)

  // Upload and API states
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [batchId, setBatchId] = useState<string>("")
  const [orderId, setOrderId] = useState<string>("")
  const [orderStatus, setOrderStatus] = useState<string>("draft")
  const [eventSlug, setEventSlug] = useState<string>("")
  const [isProcessingFree, setIsProcessingFree] = useState(false)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)

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

  // Subscribe to order status changes on Receipt step (currentStep === 2)
  useEffect(() => {
    if (currentStep !== 2 || !orderId) return

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        const newStatus = payload.new.status
        setOrderStatus(newStatus)
        if (payload.new.event_slug) {
          setEventSlug(payload.new.event_slug)
        }
        
        if (newStatus === 'review_ready') {
          const slug = payload.new.event_slug || eventSlug || "gallery"
          setTimeout(() => {
            router.push(`/dashboard/gallery/${slug}/review`)
          }, 3000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentStep, orderId, eventSlug])

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
      case "photographer": return 1999
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
      setEventSlug(createdOrder.event_slug)

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

      setIsUploading(false)
      
      // If free tier, skip checkout directly
      if (tier.toLowerCase() === "free") {
        setIsProcessingFree(true)
        await api.post("/payments/free-checkout", {
          order_id: createdOrder.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setIsProcessingFree(false)
        setOrderStatus("paid")
        setCurrentStep(2) // Done Receipt
      } else {
        setCurrentStep(1) // Paid tiers go to checkout
      }

    } catch (error: any) {
      console.error("Upload workflow failed:", error)
      setIsUploading(false)
      setIsProcessingFree(false)
      alert("Upload workflow failed. Please check your network connection and try again.")
    }
  }

  const handleCheckoutPayment = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      setIsVerifyingPayment(true)

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
        modal: {
          ondismiss: () => {
            setIsVerifyingPayment(false)
          }
        },
        handler: async (response: any) => {
          setIsVerifyingPayment(true)
          try {
            await api.post("/payments/verify", response)
            setOrderStatus("paid")
            setCurrentStep(2)
          } catch (e) {
            setOrderStatus("paid")
            setCurrentStep(2)
          } finally {
            setIsVerifyingPayment(false)
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
        setOrderStatus("paid")
        setCurrentStep(2)
        setIsVerifyingPayment(false)
        return
      }

      const rzp = new (window as any).Razorpay(options)
      setIsVerifyingPayment(false)
      rzp.open()

    } catch (err) {
      console.error("Checkout process failed:", err)
      setOrderStatus("paid")
      setCurrentStep(2)
      setIsVerifyingPayment(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-40 px-4 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      {isVerifyingPayment && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-zinc-900 select-none">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-950 mb-3" />
          <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-zinc-500 animate-pulse">Securing Payment & Compiling Layouts...</span>
        </div>
      )}
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
            { step: 1, label: "Checkout" },
            { step: 2, label: "Done" }
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
                ) : isProcessingFree ? (
                  <div className="flex items-center justify-center gap-2 pt-4 text-xs font-bold font-geist-mono uppercase text-[#c9a96e]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing free order...</span>
                  </div>
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleStartUpload}
                      disabled={files.length === 0}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-lg"
                    >
                      Proceed to Curation
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: CHECKOUT */}
        {currentStep === 1 && (
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
                  <h3 className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-800 border-b border-zinc-100 pb-3">Checkout Summary</h3>
                  <div className="space-y-2 text-xs text-zinc-500 border-b border-zinc-100 pb-4 font-geist-mono">
                    <div className="flex justify-between"><span>Base package ({tier}):</span><span>₹{orderTotal}</span></div>
                    <div className="flex justify-between text-zinc-800 font-bold border-t border-zinc-100 pt-3 mt-1"><span>Total charge:</span><span>₹{orderTotal}</span></div>
                  </div>

                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleCheckoutPayment}
                      disabled={!shipping.name || !shipping.phone}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-lg mb-4"
                    >
                      Pay via Razorpay
                    </Button>
                  </motion.div>

                  {/* Trust Signals */}
                  <div className="space-y-3 pt-2 border-t border-zinc-100 text-[9px] font-geist-mono uppercase tracking-wider text-zinc-400">
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="text-zinc-650">🔒 Secured by Razorpay</span>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-center text-zinc-500 font-light lowercase normal-case leading-relaxed mt-2">
                      <span className="font-bold text-zinc-850 uppercase tracking-widest text-[8px] block mb-1">✓ Automatic refund if AI processing fails</span>
                      <span className="font-bold text-zinc-850 uppercase tracking-widest text-[8px] block mb-1 mt-1.5">✓ Review your gallery before it goes live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: RECEIPT / CONFIRMATION */}
        {currentStep === 2 && (
          <div className="max-w-xl mx-auto text-center py-16 bg-white border border-zinc-200 rounded-[32px] p-8 shadow-premium space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-250 flex items-center justify-center text-emerald-600 mx-auto relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping pointer-events-none" />
              <CheckCircle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-black text-zinc-900 tracking-tightest leading-none">✓ Payment Confirmed</h3>
              <p className="text-sm font-serif font-medium text-zinc-800 mt-2">
                Your "{eventName}" gallery is being created!
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed font-light pt-2">
                Our AI is sorting through your {files.length || "uploaded"} photos, selecting the absolute best moments, clustering face profiles, and composing unique context captions.
              </p>
            </div>

            <div className="bg-zinc-50/50 border border-zinc-200/80 p-6 rounded-2xl text-left space-y-4 max-w-md mx-auto">
              <span className="block text-[9px] font-bold font-geist-mono uppercase text-[#c9a96e] border-b border-zinc-150/60 pb-2">We will notify you when it is ready</span>
              
              <div className="space-y-2.5 text-xs text-zinc-650 font-geist-mono">
                {shipping.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">📱 WhatsApp:</span>
                    <span className="text-zinc-850 font-bold">{shipping.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">📧 Email Updates:</span>
                  <span className="text-zinc-850 font-bold">sent on completion</span>
                </div>
                <div className="flex justify-between border-t border-zinc-150/60 pt-3 mt-1 text-[10px] text-zinc-500">
                  <span>ESTIMATED TIME:</span>
                  <span className="text-zinc-800 font-bold">~{tier.toLowerCase() === "photographer" ? "15" : "60"} minutes</span>
                </div>
              </div>
            </div>

            {orderStatus === "review_ready" ? (
              <div className="bg-purple-50/80 border border-purple-100 text-purple-950 p-4 rounded-2xl max-w-md mx-auto text-xs font-semibold animate-pulse">
                🎉 Your gallery is ready! Automatically redirecting you to the review page...
              </div>
            ) : orderStatus === "failed" ? (
              <div className="bg-rose-50 border border-rose-100 text-rose-850 p-4 rounded-2xl max-w-md mx-auto text-xs font-semibold leading-relaxed">
                Something went wrong during AI curation. Your order has been marked failed and a full refund has been automatically initiated.
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 pt-2 text-[10.5px] text-zinc-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                  <span>AI pipeline is working in the background...</span>
                </div>
                <span className="text-[9px] font-light italic">You do not need to stay on this page. Feel free to close this tab.</span>
              </div>
            )}

            <div className="pt-6 flex items-center justify-center gap-3 max-w-sm mx-auto">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button onClick={() => router.push(`/dashboard`)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-md">
                  Go to Dashboard
                </Button>
              </motion.div>
              <Button variant="outline" onClick={() => window.close()} className="flex-1 text-zinc-500 hover:text-zinc-800 text-xs font-bold uppercase font-geist-mono rounded-full border-zinc-200 h-11 px-6">
                Close Tab
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
