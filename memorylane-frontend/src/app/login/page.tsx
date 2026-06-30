"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Mail, Phone, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { signInWithGoogle, signInWithEmail, signInWithPhone, verifyPhoneOtp } from "@/lib/auth"

const COLLAGE_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507504038482-762103743ec1?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519225495810-7512c696505a?w=600&auto=format&fit=crop"
]

const TESTIMONIALS = [
  { text: "MemoryLane turned our 300 wedding photos into a breathtaking story in minutes.", author: "Aditi S., Mumbai" },
  { text: "The captions were so emotional, my mother cried when reading the digital book.", author: "Rahul K., Delhi" },
  { text: "Incredibly fast curation. A must-have for trips and festivals.", author: "Sneha P., Bangalore" }
]

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<"options" | "email" | "phone">("options")
  const [emailInput, setEmailInput] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""))
  const [otpSent, setOtpSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testimonialIdx, setTestimonialIdx] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))

  // Rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  // 1. Google OAuth
  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Failed to initialize Google Login.")
      setLoading(false)
    }
  }

  // 2. Email Magic Link
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput) return
    setLoading(true)
    setErrorMsg(null)
    setMessage(null)

    try {
      await signInWithEmail(emailInput)
      setMessage("Magic link dispatched! Verify your email inbox to sign in.")
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Failed to send magic link.")
    } finally {
      setLoading(false)
    }
  }

  // 3. Phone OTP Send
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneInput) return
    setLoading(true)
    setErrorMsg(null)
    setMessage(null)

    try {
      await signInWithPhone(phoneInput)
      setOtpSent(true)
      setMessage("Verification code sent to +91 " + phoneInput)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      console.error(err)
      // Dev mode SMS fallback if offline/unconfigured
      if (process.env.NODE_ENV === "development") {
        setOtpSent(true)
        setMessage("Success (Simulated). Enter 123456 as verification code.")
      } else {
        setErrorMsg(err.message || "Failed to send SMS verification OTP.")
      }
    } finally {
      setLoading(false)
    }
  }

  // 4. Phone OTP Verify
  const handleOtpChange = (val: string, index: number) => {
    const cleaned = val.replace(/[^0-9]/g, "")
    if (!cleaned) return

    const newValues = [...otpValues]
    newValues[index] = cleaned.substring(cleaned.length - 1)
    setOtpValues(newValues)

    if (index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        const newValues = [...otpValues]
        newValues[index - 1] = ""
        setOtpValues(newValues)
        otpRefs.current[index - 1]?.focus()
      } else {
        const newValues = [...otpValues]
        newValues[index] = ""
        setOtpValues(newValues)
      }
    }
  }

  // Trigger verify automatically when 6 digits are filled
  useEffect(() => {
    const code = otpValues.join("")
    if (code.length === 6) {
      const verifyCode = async () => {
        setLoading(true)
        setErrorMsg(null)
        try {
          // Dev mock checks
          if (process.env.NODE_ENV === "development" && (code === "123456" || code === "123400")) {
            setMessage("Success (Simulated)! Syncing account...")
            setTimeout(() => {
              window.location.href = "/dashboard"
            }, 1000)
            return
          }

          await verifyPhoneOtp(phoneInput, code)
          
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            window.location.href = "/dashboard"
          }
        } catch (err: any) {
          console.error(err)
          setErrorMsg(err.message || "Invalid OTP code. Please retry.")
        } finally {
          setLoading(false)
        }
      }
      verifyCode()
    }
  }, [otpValues])

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex relative overflow-hidden">
      
      {/* LEFT HALF COLLAGE - DESKTOP ONLY */}
      <div className="hidden md:flex md:w-1/2 bg-[#09090b] relative flex-col justify-between p-12 overflow-hidden select-none border-r border-zinc-800">
        <div className="absolute inset-0 grid grid-cols-2 gap-4 p-8 opacity-45 scale-[1.02]">
          {COLLAGE_IMAGES.map((url, i) => (
            <div 
              key={i} 
              className={`relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/5 shadow-2xl ${
                i % 3 === 0 ? "scale-95" : i % 3 === 1 ? "translate-y-4" : "-translate-y-4"
              }`}
            >
              <Image 
                src={url} 
                alt="Ken Burns Collage" 
                fill 
                sizes="400px"
                className="object-cover animate-[kenBurns_30s_infinite_alternate] ease-in-out" 
                style={{ animationDelay: `${i * 3}s` }}
              />
            </div>
          ))}
        </div>

        {/* Ambient Dark Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

        {/* Top Header Logo */}
        <div className="relative z-20 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-serif font-black tracking-tightest uppercase text-sm">MemoryLane</span>
        </div>

        {/* Bottom Testimonials & Callout */}
        <div className="relative z-20 space-y-8 max-w-lg mt-auto">
          <h1 className="text-3xl font-serif font-bold text-white tracking-tightest leading-tight">
            Thousands of families trust MemoryLane with their most precious memories.
          </h1>

          <div className="min-h-[80px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
                className="space-y-1"
              >
                <p className="text-zinc-300 italic text-sm font-light">
                  "{TESTIMONIALS[testimonialIdx].text}"
                </p>
                <p className="text-[10px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">
                  — {TESTIMONIALS[testimonialIdx].author}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RIGHT HALF AUTH PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-16 bg-[#FAFAF8] relative min-h-screen">
        <div className="w-full max-w-sm space-y-8">
          
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-800 text-[9px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Home</span>
            </Link>
            {authMode !== "options" && (
              <Button 
                variant="ghost" 
                onClick={() => { setAuthMode("options"); setOtpSent(false); setMessage(null); setErrorMsg(null); }}
                className="text-[9px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-800 hover:bg-transparent"
              >
                Back to sign in options
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 md:hidden">
              <Sparkles className="w-4 h-4 text-zinc-900" />
              <span className="font-serif font-black text-xs uppercase tracking-widest">MemoryLane</span>
            </div>
            <h2 className="text-3xl font-serif font-black text-zinc-900 tracking-tightest leading-none">Preserve your memories.</h2>
            <p className="text-xs text-zinc-400 font-light">Access your digital books and AI curation dashboard.</p>
          </div>

          {/* Feedback alerts */}
          {message && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl text-xs flex items-start gap-2.5 font-light">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl text-xs flex items-start gap-2.5 font-light">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Google Login Option */}
            <div className="space-y-3">
              <Button 
                onClick={handleGoogleLogin} 
                disabled={loading}
                className="w-full bg-white border border-zinc-250 text-zinc-700 hover:bg-[#F8F8F8] h-12 rounded-full text-xs font-semibold flex items-center justify-center gap-3 transition-all shadow-sm font-sans"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-zinc-200"></div>
                <span className="flex-shrink mx-4 text-[9px] font-bold font-geist-mono uppercase tracking-widest text-zinc-400">or email magic link</span>
                <div className="flex-grow border-t border-zinc-200"></div>
              </div>
            </div>

            {/* Email form directly presented */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Email Address</label>
                <Input 
                  type="email" 
                  value={emailInput} 
                  onChange={(e) => setEmailInput(e.target.value)} 
                  placeholder="name@example.com" 
                  className="bg-white border-zinc-200 text-xs rounded-xl h-12 px-4 shadow-sm"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs uppercase tracking-wider font-geist-mono h-12 rounded-xl shadow-lg transition-all"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          </div>

          <p className="text-[10px] text-zinc-400 text-center font-light leading-relaxed">
            By continuing, you agree to our <Link href="#" className="underline text-zinc-500">Terms of Service</Link> and <Link href="#" className="underline text-zinc-500">Privacy Policy</Link>.
          </p>

        </div>
      </div>

      {/* Global CSS for Ken Burns Effect */}
      <style jsx global>{`
        @keyframes kenBurns {
          0% {
            transform: scale(1) translate(0px, 0px);
          }
          100% {
            transform: scale(1.06) translate(5px, 2px);
          }
        }
      `}</style>

    </div>
  )
}
