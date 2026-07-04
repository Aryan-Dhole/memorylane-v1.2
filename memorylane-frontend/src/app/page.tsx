"use client"

import React, { useRef, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  motion, AnimatePresence
} from "framer-motion"
import {
  ArrowRight, ShieldCheck, Heart,
  ChevronDown, Maximize2, Zap, UploadCloud, Users, Camera
} from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Logo from "@/components/logo"
import CinematicPhotoStream from "@/components/cinematic-photo-stream"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TIERS } from "@/lib/pricing"
import { supabase } from "@/lib/supabase"

// Register GSAP ScrollTrigger safely on client
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

function FadeUpText({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const [sessionUser, setSessionUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user || null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Clear any potential leftover ScrollTriggers to prevent duplicates on hot-reloading
    ScrollTrigger.getAll().forEach(t => {
      if (t.trigger === heroRef.current) {
        t.kill()
      }
    })

    const ctx = gsap.context(() => {
      // Hero Pin timeline (scrubbed on scroll)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: true,
        }
      })

      tl.to(".hero-text-container", {
        y: -100,
        opacity: 0.1,
        filter: "blur(12px)",
        scale: 0.95,
        ease: "power1.inOut"
      })
        .to(".hero-book-preview", {
          y: -120,
          scale: 1.1,
          opacity: 1,
          ease: "power2.out"
        }, "<")

      // Stats counters trigger once on scroll
      gsap.fromTo(".stat-num-1",
        { textContent: "0" },
        {
          textContent: "850000",
          duration: 1.8,
          ease: "power3.out",
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: statsRef.current,
            start: "top 80%",
            toggleActions: "play none none none"
          },
          onUpdate: function () {
            const el = document.querySelector(".stat-num-1")
            if (el) el.textContent = parseInt(el.textContent || "0").toLocaleString() + "+"
          }
        }
      )

      gsap.fromTo(".stat-num-2",
        { textContent: "0" },
        {
          textContent: "12000",
          duration: 1.8,
          ease: "power3.out",
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: statsRef.current,
            start: "top 80%",
            toggleActions: "play none none none"
          },
          onUpdate: function () {
            const el = document.querySelector(".stat-num-2")
            if (el) el.textContent = parseInt(el.textContent || "0").toLocaleString() + "+"
          }
        }
      )

      gsap.fromTo(".stat-num-3",
        { textContent: "0" },
        {
          textContent: "996",
          duration: 1.8,
          ease: "power3.out",
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: statsRef.current,
            start: "top 80%",
            toggleActions: "play none none none"
          },
          onUpdate: function () {
            const el = document.querySelector(".stat-num-3")
            if (el) el.textContent = (parseFloat(el.textContent || "0") / 10).toFixed(1) + "%"
          }
        }
      )

    }, containerRef)

    return () => ctx.revert()
  }, [])

  const [activeTier, setActiveTier] = useState<string | null>(null)

  return (
    <div ref={containerRef} className="bg-white text-zinc-900 min-h-screen selection:bg-zinc-900 selection:text-white font-sans relative">

      {/* STICKY HEADER */}
      <header className="fixed top-0 w-full z-[100] px-8 py-5 flex justify-between items-center backdrop-blur-md bg-black/10 border-b border-white/5 mix-blend-difference pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Logo className="w-8 h-8" />
          <span className="font-geist-mono font-bold text-xs uppercase tracking-widest text-white">MemoryLane</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 pointer-events-auto">
          <Link href="/photographer" className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-widest font-geist-mono text-white/50 hover:text-white transition-colors">
            For Photographers
          </Link>
          {sessionUser ? (
            <Link href="/dashboard" className="text-[11px] font-bold uppercase tracking-widest font-geist-mono text-[#c9a96e] hover:text-white transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-[11px] font-bold uppercase tracking-widest font-geist-mono text-white/70 hover:text-white transition-colors">
              Login
            </Link>
          )}
          <Link href="/create">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button className="rounded-full bg-white text-black hover:bg-zinc-200 text-[10px] font-bold uppercase tracking-widest font-geist-mono h-9 px-4 sm:px-6 shadow-lg">
                <span className="hidden sm:inline">Create Gallery</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </motion.div>
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section ref={heroRef} className="h-screen w-full bg-[#0a0a0f] text-white flex flex-col justify-center items-center relative overflow-hidden z-10">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,169,110,0.08)_0%,rgba(10,10,15,0)_70%)] pointer-events-none" />
        <div className="absolute inset-0 dot-grid-dark opacity-40 pointer-events-none" />

        <div className="hero-text-container text-center max-w-4xl px-6 flex flex-col items-center z-10 select-none">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-geist-mono text-[9px] text-[#c9a96e] uppercase tracking-widest block mb-6 px-4 py-1.5 border border-[#c9a96e]/30 rounded-full bg-black/40 shadow-sm"
          >
            AI-POWERED PRIVATE EVENT GALLERIES
          </motion.span>

          <h1 className="text-7xl md:text-[6.8vw] leading-[1.05] font-serif tracking-tightest text-white mb-6">
            <motion.span
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="block"
            >
              Share moments
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="block bg-gradient-to-r from-zinc-100 via-zinc-400 to-[#c9a96e] bg-clip-text text-transparent"
            >
              in cinematic flows.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-xs md:text-sm font-geist-mono text-zinc-450 tracking-widest uppercase max-w-lg mx-auto mb-10 leading-relaxed"
          >
            A premium visual space for weddings, festivals & special gatherings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.4 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link href="/create">
              <Button className="bg-[#faf9f7] text-black hover:bg-[#c9a96e] rounded-full px-8 py-6 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-xl group">
                Create Event Gallery
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Pinned Product Preview Layer (GSAP parallaxes this upwards) */}
        <div className="hero-book-preview absolute bottom-[-150px] w-full max-w-3xl aspect-[16/10] opacity-40 px-6 pointer-events-none select-none z-0">
          <div className="w-full h-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-2xl relative">
            <div className="w-full h-full rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative">
              <img
                src="https://images.unsplash.com/photo-1595981234058-a9302fb97229?auto=format&fit=crop&q=80&w=1200"
                alt="Product preview"
                className="w-full h-full object-cover grayscale-[30%] opacity-80 absolute inset-0"
              />
            </div>
          </div>
        </div>

      </section>

      {/* STATS SECTION */}
      <section ref={statsRef} className="py-40 px-6 bg-white border-t border-zinc-150 relative z-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">

            <div className="interactive-hover">
              <span className="stat-num-1 text-5xl md:text-7xl font-serif font-black text-zinc-900 tracking-tightest">0+</span>
              <p className="mt-4 text-[10px] font-geist-mono text-zinc-400 uppercase tracking-widest">Images Indexed</p>
            </div>

            <div className="interactive-hover">
              <span className="stat-num-2 text-5xl md:text-7xl font-serif font-black text-zinc-900 tracking-tightest">0+</span>
              <p className="mt-4 text-[10px] font-geist-mono text-zinc-400 uppercase tracking-widest">Galleries Shared</p>
            </div>

            <div className="interactive-hover">
              <span className="stat-num-3 text-5xl md:text-7xl font-serif font-black text-zinc-900 tracking-tightest">0.0%</span>
              <p className="mt-4 text-[10px] font-geist-mono text-zinc-400 uppercase tracking-widest">Aesthetic Approval Rate</p>
            </div>

          </div>
        </div>
      </section>

      {/* CINEMATIC PHOTO STREAM */}
      <CinematicPhotoStream />

      {/* PROCESS SECTION */}
      <section className="py-40 px-6 bg-[#fafafa] z-20 relative border-t border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <FadeUpText>
            <div className="mb-24 text-center">
              <span className="font-geist-mono text-[10px] text-zinc-400 uppercase tracking-widest">Process Flow</span>
              <h2 className="text-5xl md:text-7xl font-serif font-black tracking-tightest leading-none mt-4 text-zinc-900">AI-Curated Delivery</h2>
            </div>
          </FadeUpText>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: <UploadCloud className="w-6 h-6" />, title: "PRECISE STREAMING", desc: "Upload hundreds of photos. All files store securely on S3 under encrypted tokens." },
              { step: "02", icon: <Zap className="w-6 h-6" />, title: "curation & sequencing", desc: "Our pipeline rejects duplicates and blurry shots, groups images by chronologic scenes, and structures a story arc." },
              { step: "03", icon: <Users className="w-6 h-6" />, title: "face cluster index", desc: "AI maps face landmarks to form individual crop filters, enabling guests to find photos of themselves instantly." }
            ].map((p, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-8 rounded-3xl border border-zinc-200/80 bg-white shadow-premium flex flex-col justify-between h-[250px] cursor-default transition-all duration-300"
              >
                <div className="flex justify-between items-center">
                  <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 bg-[#fafafa]">
                    {p.icon}
                  </div>
                  <span className="font-geist-mono text-zinc-350 font-bold text-lg">{p.step}</span>
                </div>
                <div>
                  <h4 className="font-geist-mono text-xs font-bold uppercase tracking-wider text-zinc-800 mb-2">{p.title}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed font-light">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* THE EDITIONS SECTION */}
      <section className="py-40 px-6 bg-white z-20 relative border-t border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <FadeUpText>
            <div className="text-center mb-24">
              <h2 className="text-5xl md:text-7xl font-serif font-black tracking-tightest leading-none text-zinc-900">The Editions</h2>
              <p className="mt-4 text-zinc-400 font-geist-mono text-xs uppercase tracking-widest">Select event delivery capacities</p>
            </div>
          </FadeUpText>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(TIERS).map((tier) => {
              const isActive = activeTier === tier.id

              return (
                <motion.div
                  key={tier.id}
                  layoutId={`tier-${tier.id}`}
                  onClick={() => setActiveTier(isActive ? null : tier.id)}
                  whileHover={{ y: isActive ? 0 : -6 }}
                  className={`relative cursor-pointer overflow-hidden bg-white border border-zinc-200/80 rounded-3xl shadow-premium smooth-transition ${isActive ? "lg:col-span-2 min-h-[380px] ring-2 ring-zinc-900" : "h-[280px]"
                    }`}
                >
                  <motion.div layout className="p-8 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <motion.span layout className="font-geist-mono text-[9px] uppercase tracking-widest text-[#c9a96e] font-bold">
                        {tier.maxSelected} Selected / {tier.maxPhotos} Max
                      </motion.span>
                      <motion.h3 layout className="text-2xl font-serif font-black tracking-tight mt-2 text-zinc-900">
                        {tier.name.toUpperCase()} EDITION
                      </motion.h3>
                      <motion.p layout className="text-xs text-zinc-500 font-light mt-1">{tier.description}</motion.p>
                    </div>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="py-4 border-y border-zinc-100 my-4 grid grid-cols-2 gap-4 text-xs font-light"
                        >
                          <div>
                            <span className="block text-zinc-400 text-[8px] font-geist-mono mb-0.5">FACE FILTERING</span>
                            <span className="font-medium text-zinc-800">{tier.faceFilter ? "Included" : "Not Included"}</span>
                          </div>
                          <div>
                            <span className="block text-zinc-400 text-[8px] font-geist-mono mb-0.5">DURATION</span>
                            <span className="font-medium text-zinc-800">{tier.galleryDurationDays ? `${tier.galleryDurationDays} Days` : "Lifetime access"}</span>
                          </div>
                          <div>
                            <span className="block text-zinc-400 text-[8px] font-geist-mono mb-0.5">COLLABORATION</span>
                            <span className="font-medium text-zinc-800">{tier.guestUploads ? "Guest Uploads active" : "Disabled"}</span>
                          </div>
                          <div>
                            <span className="block text-zinc-400 text-[8px] font-geist-mono mb-0.5">CUSTOM SLUG</span>
                            <span className="font-medium text-zinc-800">{tier.customSlug ? "Active" : "Disabled"}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex justify-between items-end">
                      <motion.span layout className="text-2xl font-black font-geist-mono tracking-tighter text-zinc-900">
                        {tier.price === 0 ? "FREE" : `₹${tier.price}`}
                      </motion.span>

                      {isActive ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                        >
                          <Link href={`/create`}>
                            <Button className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-6 py-5 text-[10px] font-bold uppercase tracking-widest font-geist-mono shadow-md">
                              Start Creating
                            </Button>
                          </Link>
                        </motion.div>
                      ) : (
                        <motion.div layout className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-50 hover:bg-zinc-100 transition-colors">
                          <Maximize2 className="w-3.5 h-3.5 text-zinc-500" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-40 px-6 max-w-4xl mx-auto z-10 relative">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none text-zinc-900">FAQ</h2>
        </div>

        <Accordion className="space-y-3">
          {[
            { q: "How secure is my personal event gallery?", a: "Extremely secure. Every gallery is assigned a unique randomized token URL slug. The gallery link is only visible to you and the people you share the URL with." },
            { q: "How does the guest upload feature work?", a: "If enabled in settings, guests can drag/drop photos from their phones directly. The AI instantly scores their photos; high-quality uploads go live automatically, while low-quality images are queued for your review." },
            { q: "Can guests find photos of themselves?", a: "Yes. Our pipeline processes all photos, extracts face landmarks, and generates a visual crop circle strip. Guests simply tap their face to instantly filter the entire gallery to only show their photos." }
          ].map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border border-zinc-200/80 bg-white rounded-2xl px-6 data-[state=open]:border-zinc-400 transition-all shadow-sm">
              <AccordionTrigger className="text-zinc-800 hover:text-zinc-600 font-geist-mono text-xs uppercase tracking-widest py-5">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-zinc-500 text-sm font-light leading-relaxed pb-5">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FOOTER */}
      <footer className="py-16 px-6 border-t border-zinc-200/60 text-zinc-400 text-[10px] font-geist-mono uppercase tracking-widest flex flex-col md:flex-row justify-between items-center gap-6 z-10 relative bg-[#fafafa]">
        <div className="flex items-center gap-4">
          <Logo className="w-6 h-6 opacity-70" />
          <span>© 2026 MEMORYLANE SYSTEM INC</span>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center">
          <Link href="/privacy" className="hover:text-zinc-700 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-700 transition-colors">Terms</Link>
          <Link href="/refunds" className="hover:text-zinc-700 transition-colors">Refunds</Link>
          <Link href="/shipping" className="hover:text-zinc-700 transition-colors">Shipping</Link>
          <Link href="/contact" className="hover:text-zinc-700 transition-colors">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
