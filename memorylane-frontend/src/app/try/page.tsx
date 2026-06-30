"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { motion } from "framer-motion"
import { Sparkles, UploadCloud, ChevronRight, CheckCircle2, Image as ImageIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import Logo from "@/components/logo"

const THEMES = [
  { id: "wedding", label: "Wedding" },
  { id: "baby", label: "Baby Shower" },
  { id: "travel", label: "Travel / Trip" },
  { id: "birthday", label: "Birthday" },
  { id: "other", label: "Other Celebration" }
]

export default function FreeTrialLanding() {
  const router = useRouter()
  const [selectedTheme, setSelectedTheme] = useState("travel")
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [] },
    maxFiles: 10,
    onDrop: (acceptedFiles) => {
      setErrorMsg(null)
      const totalCount = files.length + acceptedFiles.length
      if (totalCount > 10) {
        setErrorMsg("Free trial is capped at exactly 10 photos maximum.")
        return
      }
      setFiles((prev) => [...prev, ...acceptedFiles])
    }
  })

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleStartTrial = async () => {
    if (files.length === 0) {
      setErrorMsg("Please select at least 1 photo to see the magic.")
      return
    }
    setIsUploading(true)
    setErrorMsg(null)

    try {
      // 1. Initialize trial session
      const startRes = await api.post("/trial/start", {
        event_type: selectedTheme
      })
      const { trial_id, upload_urls } = startRes.data

      // 2. Upload each file to presigned URL
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

      // 3. Confirm trial session files upload
      await api.post("/trial/confirm", {
        trial_id: trial_id,
        uploaded_keys: uploadedKeys
      })

      // 4. Start AI curation pipeline processing
      await api.post(`/trial/process/${trial_id}`)

      // Redirect to processing loop
      router.push(`/try/processing?id=${trial_id}`)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.response?.data?.detail || "Something went wrong. Please check your network and retry.")
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans py-32 px-6 relative dot-grid-light selection:bg-zinc-900 selection:text-white">
      
      {/* Top logo */}
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-16">
        <Logo />
        <Button variant="ghost" onClick={() => router.push("/login")} className="text-xs font-bold font-geist-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-900">
          Sign In
        </Button>
      </div>

      <div className="max-w-3xl mx-auto space-y-12 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="text-[10px] text-[#c9a96e] font-bold font-geist-mono uppercase tracking-widest bg-zinc-100 border border-zinc-200/60 rounded-full px-4 py-1.5">Free Trial Preview</span>
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tightest leading-none text-zinc-900">
            Try MemoryLane free — no account needed.
          </h1>
          <p className="text-zinc-500 text-sm font-light">
            Upload up to 10 photos. Watch our AI analyze quality, detect duplicates, group chapters, and generate poetic captions. Takes 2 minutes.
          </p>
        </div>

        {/* Content main box */}
        <div className="bg-white border border-zinc-200 rounded-[32px] p-6 md:p-10 shadow-premium space-y-8">
          
          {/* Pills Selector */}
          <div className="space-y-3">
            <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400 ml-1">1. Choose your theme</label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`px-4 py-2 text-xs font-bold font-geist-mono rounded-full border transition-all uppercase tracking-wider ${
                    selectedTheme === theme.id 
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-102"
                      : "bg-[#fafafa] border-zinc-200 text-zinc-550 hover:bg-zinc-50"
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload panel */}
          <div className="space-y-3">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400">2. Drop your photos</label>
              <span className="text-[9px] font-bold font-geist-mono uppercase text-zinc-400">{files.length} / 10 added</span>
            </div>

            {files.length < 10 && (
              <div 
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragActive ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-[#fafafa] hover:border-zinc-400"
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-xs font-medium text-zinc-700">Drag & drop files here, or <span className="underline">browse</span></p>
                <p className="text-[10px] text-zinc-400 mt-1 font-light">JPEG or PNG only, up to 10MB per file.</p>
              </div>
            )}

            {/* List thumbnails */}
            {files.length > 0 && (
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 pt-3">
                {files.map((file, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-zinc-200 relative group shadow-sm bg-zinc-50">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="thumb" 
                      className="w-full h-full object-cover" 
                    />
                    <button 
                      onClick={() => removeFile(i)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity border-none cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Errors and Progress */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl text-xs flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-bold font-geist-mono uppercase text-zinc-450">
                <span>Uploading resources...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/40">
                <div 
                  className="h-full bg-zinc-900 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleStartTrial}
                disabled={files.length === 0 || isUploading}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider font-geist-mono h-14 rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                {isUploading ? "Starting curation pipeline..." : "See the magic"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

        </div>

        {/* Explain Grid */}
        <div className="grid sm:grid-cols-3 gap-8 pt-8 border-t border-zinc-200/60">
          <div className="space-y-2 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold font-geist-mono text-xs text-zinc-700 mx-auto sm:mx-0">1</div>
            <h4 className="text-sm font-serif font-black text-zinc-900">Upload 10 Photos</h4>
            <p className="text-zinc-500 text-xs font-light leading-relaxed">No account or signup forms required. Zero cost.</p>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold font-geist-mono text-xs text-zinc-700 mx-auto sm:mx-0">2</div>
            <h4 className="text-sm font-serif font-black text-zinc-900">AI Analyzes & Captions</h4>
            <p className="text-zinc-500 text-xs font-light leading-relaxed">Our pipeline select duplicates, scores resolution, and builds captions.</p>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold font-geist-mono text-xs text-zinc-700 mx-auto sm:mx-0">3</div>
            <h4 className="text-sm font-serif font-black text-zinc-900">See Your Preview</h4>
            <p className="text-zinc-500 text-xs font-light leading-relaxed">View a gorgeous parallax watermarked digital stream of your picks.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
