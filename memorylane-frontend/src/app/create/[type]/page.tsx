"use client"

import React, { useState, use } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Layers, FileText, Calendar, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TIERS } from "@/lib/pricing"

interface PageProps {
  params: Promise<{ type: string }>
}

export default function ConfigurationSelector({ params }: PageProps) {
  const resolvedParams = use(params)
  const eventType = resolvedParams.type
  
  const [eventName, setEventName] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventLocation, setEventLocation] = useState("")
  const [selectedTier, setSelectedTier] = useState<"free" | "basic" | "premium">("basic")

  const activeTierObj = TIERS[selectedTier]

  const getTierDetails = (id: typeof selectedTier) => {
    const t = TIERS[id]
    return [
      `Up to ${t.maxPhotos} photos upload limit`,
      `AI sequencing selects best ${t.maxSelected}`,
      t.galleryDurationDays ? `Gallery live for ${t.galleryDurationDays} days` : "Gallery live forever (No expiration)",
      t.watermark ? "Includes MemoryLane watermark" : "White-labeled (No watermark)",
      t.faceFilter ? "Includes interactive Face Grouping filter" : "No face filter",
      t.guestUploads ? "Allows guest uploads & uploads review" : "Guest uploads disabled"
    ]
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-40 px-6 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-zinc-200/20 blur-[150px] pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <Link href="/create" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-16 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Theme Selection</span>
        </Link>
        
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-white shadow-sm text-[9px] font-bold uppercase tracking-widest text-zinc-450 font-geist-mono mb-6">
            <span>Step 02 / 03</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif font-black text-zinc-900 tracking-tightest leading-none mb-6">
            Configure your <br />
            event gallery
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl leading-relaxed font-light">
            Set up your event's display details and choose a gallery tier. Your live interactive URL is built instantly on completion.
          </p>
        </div>

        {/* Configurations Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12 items-start">
          
          {/* Metadata details fields */}
          <div className="space-y-6 bg-white border border-zinc-200/80 rounded-[32px] p-8 shadow-premium">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-geist-mono flex items-center gap-2 border-b border-zinc-100 pb-3 mb-2">
              <FileText className="w-4 h-4 text-zinc-400" />
              <span>Event Details</span>
            </h2>

            {/* Event Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-mono font-bold uppercase text-zinc-500 tracking-widest">Event Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Aditi & Kabir's Wedding"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="bg-[#fafafa] border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-800 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Event Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-mono font-bold uppercase text-zinc-500 tracking-widest">Event Date</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="bg-[#fafafa] border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-800 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Event Location */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-mono font-bold uppercase text-zinc-500 tracking-widest">Venue Location</label>
              <input
                type="text"
                placeholder="e.g. Taj Lands End, Mumbai"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                className="bg-[#fafafa] border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-800 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>
          </div>

          {/* Tiers Selection Column */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-geist-mono flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span>Select Plan</span>
            </h2>
            
            {(["free", "basic", "premium"] as const).map((tierId, idx) => {
              const tier = TIERS[tierId]
              const isSelected = selectedTier === tierId
              
              return (
                <motion.div 
                  key={tierId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 25, delay: idx * 0.05 }}
                  onClick={() => setSelectedTier(tierId)}
                  className={`bg-white border rounded-3xl cursor-pointer p-6 transition-all duration-300 shadow-premium ${
                    isSelected ? "border-zinc-900 ring-1 ring-zinc-900 scale-[1.01]" : "border-zinc-200/80 hover:border-zinc-400"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-geist-mono text-zinc-800">
                        {tier.name} Edition
                      </h4>
                      <span className="text-[9px] text-zinc-400 block mt-1">
                        Curates {tier.maxSelected} of {tier.maxPhotos} photos
                      </span>
                    </div>
                    <span className="text-sm font-black text-zinc-900 font-geist-mono">
                      {tier.price === 0 ? "FREE" : `₹${tier.price}`}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Selected Tier features overview */}
        <div className="bg-white border border-zinc-200 rounded-[32px] p-8 shadow-premium mb-12">
          <div className="space-y-4">
            <span className="text-[9px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest">Plan Features Included</span>
            <h3 className="text-xl font-serif font-black text-zinc-900 leading-none">{activeTierObj.name} Edition</h3>
            
            <ul className="grid sm:grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-[11px] text-zinc-550 leading-relaxed">
              {getTierDetails(selectedTier).map((detail, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a96e] shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end border-t border-zinc-200/60 pt-8 mt-12">
          <Link href={`/create/upload?type=${eventType}&tier=${selectedTier}&event_name=${encodeURIComponent(eventName || "My Event")}&event_date=${eventDate}&event_location=${encodeURIComponent(eventLocation)}`}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                size="lg" 
                disabled={!eventName || !eventDate}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-6 px-8 rounded-full shadow-lg group disabled:opacity-50"
              >
                Proceed to Upload
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  )
}
