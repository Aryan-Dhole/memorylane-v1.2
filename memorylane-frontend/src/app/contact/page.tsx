"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Phone, MapPin, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setForm({ name: "", email: "", subject: "", message: "" })
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-24 px-6 md:px-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-800 mb-12 text-[10px] font-bold font-geist-mono uppercase tracking-widest transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Home</span>
        </Link>

        <header className="mb-16">
          <span className="text-[10px] font-bold font-geist-mono uppercase tracking-widest text-[#c9a96e] block mb-3">Get in Touch</span>
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none mb-4 text-zinc-900">Contact Us</h1>
          <p className="text-sm text-zinc-500 max-w-lg leading-relaxed font-light">Have questions about our AI curation pipeline, billing, custom gallery limits, or API integrations? Drop us a message.</p>
        </header>

        <div className="grid md:grid-cols-5 gap-12 items-start">
          {/* Left panel contact cards */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-800 border-b border-zinc-150 pb-3">Support Desks</h3>
              
              <div className="flex items-start gap-3 text-xs">
                <Mail className="w-4 h-4 text-[#c9a96e] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold text-zinc-800 font-geist-mono text-[9px] uppercase tracking-wider">General & Help</span>
                  <a href="mailto:support@memorylane.in" className="text-zinc-500 hover:text-zinc-900 transition-colors">support@memorylane.in</a>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <Mail className="w-4 h-4 text-[#c9a96e] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold text-zinc-800 font-geist-mono text-[9px] uppercase tracking-wider">Refunds & Billing</span>
                  <a href="mailto:refunds@memorylane.in" className="text-zinc-500 hover:text-zinc-900 transition-colors">refunds@memorylane.in</a>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-800 border-b border-zinc-150 pb-3">Office Details</h3>

              <div className="flex items-start gap-3 text-xs">
                <Phone className="w-4 h-4 text-[#c9a96e] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold text-zinc-800 font-geist-mono text-[9px] uppercase tracking-wider">Telephone Desk</span>
                  <span className="text-zinc-500 font-light">+91 22 5557 9821</span>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <MapPin className="w-4 h-4 text-[#c9a96e] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold text-zinc-800 font-geist-mono text-[9px] uppercase tracking-wider">Registered Corporate Address</span>
                  <p className="text-zinc-500 mt-1 leading-relaxed font-light">
                    MemoryLane Systems Private Limited,<br />
                    14th Floor, Maker Chambers V,<br />
                    Nariman Point, Mumbai,<br />
                    Maharashtra 400021, India
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel contact form */}
          <div className="md:col-span-3 bg-white border border-zinc-200/80 rounded-[32px] p-8 shadow-premium relative">
            {submitted ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-serif font-black text-zinc-900">Message Received</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed font-light">Thank you. We have logged your request. Our support engineering desk will get back to you within 24 business hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Your Name</label>
                    <Input 
                      required 
                      value={form.name} 
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Name" 
                      className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Email Address</label>
                    <Input 
                      required 
                      type="email" 
                      value={form.email} 
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="you@example.com" 
                      className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Subject</label>
                  <Input 
                    required 
                    value={form.subject} 
                    onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="How can we help?" 
                    className="bg-[#fafafa] border-zinc-200 text-xs rounded-xl h-10 px-4" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">Message Text</label>
                  <textarea 
                    required 
                    rows={4}
                    value={form.message} 
                    onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Write details of your query..." 
                    className="w-full bg-[#fafafa] border border-zinc-200 text-xs rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all text-zinc-900 font-sans" 
                  />
                </div>

                <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono py-5 rounded-full shadow-md">
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
