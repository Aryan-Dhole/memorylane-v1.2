"use client"

import React from "react"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, ShieldCheck, Heart, BarChart3, Star, Sparkles } from "lucide-react"

export default function PhotographerLandingPage() {
  return (
    <div className="w-full bg-zinc-950 text-white min-h-screen font-sans selection:bg-[#c9a96e] selection:text-zinc-950 flex flex-col justify-between overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full min-h-[90vh] py-24 px-6 md:px-12 flex flex-col justify-center items-center text-center">
        {/* Background Image bleed with dark overlays */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 filter grayscale scale-105"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&auto=format&fit=crop')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/60 to-zinc-950 pointer-events-none" />

        <div className="z-10 max-w-4xl space-y-6 mt-12 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="flex items-center gap-2 border border-[#c9a96e]/30 bg-zinc-900/40 backdrop-blur-md px-4 py-1.5 rounded-full text-[#c9a96e] mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-widest font-bold">MemoryLane B2B Portal</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-6xl md:text-7xl font-serif font-black tracking-tightest leading-tight"
          >
            Deliver your client galleries <br />
            <span className="text-[#c9a96e]">with visual AI magic.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed font-light"
          >
            Say goodbye to clunky Google Drive links. Deliver stunning, white-labeled private event galleries where guests can search by their own faces, react with emojis, and upload collaborative memories.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="pt-6 flex flex-col sm:flex-row items-center gap-4"
          >
            <a
              href="/photographer/join"
              className="inline-flex items-center gap-2 bg-[#c9a96e] text-zinc-950 text-[10px] font-bold font-mono uppercase tracking-widest py-4 px-8 rounded-full hover:bg-[#b0925c] transition-all shadow-lg shadow-[#c9a96e]/10"
            >
              Start Photographer Trial
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 text-zinc-300 font-mono text-[10px] font-bold uppercase tracking-widest py-4 px-8 rounded-full hover:border-[#c9a96e] hover:text-white transition-all"
            >
              Logged-in Portals
            </a>
          </motion.div>
        </div>
      </section>

      {/* Feature Columns */}
      <section className="w-full bg-zinc-950 py-24 px-6 md:px-12 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          
          {/* Feature 1 */}
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-[#c9a96e]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-black text-white">Full Client Branding</h3>
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Remove all MemoryLane branding. Put your own studio logo, studio name, website links, and copyright notices directly in the footer of every guest's screen.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-[#c9a96e]">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-black text-white">Face Filter Curation</h3>
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Allow hundreds of wedding guests to instantly filter down to photos containing only them by tapping their own face crop circles, saving you hours of guest request questions.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-[#c9a96e]">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-black text-white">Studio Guest Referrals</h3>
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Every guest who opens the private link can browse, download, and see your work. Acquire new bookings directly through the built-in collaborative loop.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing block */}
      <section className="w-full bg-[#0a0a0f] border-t border-zinc-900 py-24 px-6 md:px-12 text-center">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-white">Simple, predictable pricing</h2>
            <p className="text-zinc-500 text-xs leading-relaxed font-light">
              One simple plan for busy creators looking to scale client deliveries.
            </p>
          </div>

          {/* Pricing card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 text-left space-y-6 shadow-premium-dark relative">
            <div className="absolute top-4 right-4 bg-[#c9a96e] text-zinc-950 font-mono text-[8px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
              Popular
            </div>
            <div>
              <h4 className="text-lg font-serif font-black text-white">Photographer Plan</h4>
              <p className="text-xs text-zinc-500 mt-1 font-light">Deliver unlimited high-end galleries under your brand.</p>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-serif font-black text-white">₹1,999</span>
              <span className="text-xs text-zinc-500 font-mono">/ Month</span>
            </div>

            <div className="w-full h-[1px] bg-zinc-900" />

            <ul className="space-y-3.5">
              {[
                "Unlimited event gallery deliveries",
                "Up to 5,000 photos uploaded per event",
                "Self-branding (replace logo and website headers)",
                "Built-in face grouping filter strip",
                "Collaborative guest uploads & emoji reaction metrics",
                "Password protection options",
                "Priority cloud AI curation processing"
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-[#c9a96e]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="/photographer/join"
              className="block w-full text-center bg-[#faf9f7] text-zinc-950 font-mono text-[10px] font-black uppercase tracking-widest py-4 rounded-xl hover:bg-[#c9a96e] transition-all shadow-lg"
            >
              Start Free Trial Now
            </a>
          </div>
        </div>
      </section>

      {/* Small credit footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-10 text-center font-mono text-[9px] uppercase tracking-widest text-zinc-700">
        © {new Date().getFullYear()} MemoryLane AI • Photographer Workspace Portal
      </footer>
    </div>
  )
}
