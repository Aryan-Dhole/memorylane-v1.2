"use client"

import React, { useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, Check, AlertCircle, Loader2 } from "lucide-react"
import { API_BASE_URL } from "@/lib/api"

interface GuestUploadSectionProps {
  slug: string;
  onUploadSuccess: () => void;
}

export default function GuestUploadSection({ slug, onUploadSuccess }: GuestUploadSectionProps) {
  const [uploaderName, setUploaderName] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null)
  
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    // Max 10 photos upload at a time
    const filesToUpload = acceptedFiles.slice(0, 10)
    setLoading(true)
    setStatus(null)

    // Generate/retrieve unique guest session ID in localStorage
    let guestSession = localStorage.getItem("ml_guest_session")
    if (!guestSession) {
      guestSession = crypto.randomUUID()
      localStorage.setItem("ml_guest_session", guestSession)
    }

    try {
      let succeeded = 0
      let pendingReview = 0

      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append("uploader_name", uploaderName || "Guest")
        formData.append("session_id", guestSession)
        formData.append("file", file)

        const response = await fetch(`${API_BASE_URL}/gallery/${slug}/upload`, {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const resData = await response.json()
          if (resData.accepted) {
            succeeded++
          } else {
            pendingReview++
          }
        } else {
          const errorRes = await response.json()
          throw new Error(errorRes.detail || "Server error uploading photo")
        }
      }

      if (succeeded > 0 && pendingReview === 0) {
        setStatus({
          type: "success",
          message: `Success! ${succeeded} photos added directly to the gallery.`
        })
        onUploadSuccess()
      } else if (pendingReview > 0) {
        setStatus({
          type: "info",
          message: `Upload complete. ${succeeded} added directly, and ${pendingReview} photos are pending manual review by the owner.`
        })
        if (succeeded > 0) onUploadSuccess()
      } else {
        setStatus({
          type: "success",
          message: "Files submitted successfully!"
        })
      }
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error.message || "Failed to upload files. Please try again."
      })
    } finally {
      setLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxFiles: 10,
    disabled: loading
  })

  return (
    <div className="w-full bg-[#0a0a0f] border-t border-zinc-900 py-20 px-6 md:px-12 select-none flex justify-center text-center">
      <div className="w-full max-w-xl space-y-8">
        <div>
          <h2 className="text-3xl font-serif font-black tracking-tight text-white">Your photos belong here too</h2>
          <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
            Got photos from this event? Add them directly to the private shared gallery.
          </p>
        </div>

        <div className="space-y-4 text-left">
          {/* Uploader Name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Your Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Rahul's Nani, Priya's friend"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              disabled={loading}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c9a96e] transition-colors placeholder:text-zinc-700"
            />
          </div>

          {/* Dropzone container */}
          <div 
            {...getRootProps()}
            className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              isDragActive 
                ? "border-[#c9a96e] bg-[#c9a96e]/5 text-white" 
                : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/10 text-zinc-400"
            }`}
          >
            <input {...getInputProps()} />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
                <span className="text-xs font-mono text-zinc-400 uppercase">Analyzing & uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <Upload className="w-8 h-8 text-zinc-650" />
                <p className="text-xs font-bold text-zinc-300">
                  {isDragActive ? "Drop the photos here..." : "Drag photos here or tap to select"}
                </p>
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Supports JPEG/PNG • Max 10 photos</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload status panel */}
        {status && (
          <div className={`p-4 rounded-2xl border text-left flex items-start gap-3 ${
            status.type === "success" 
              ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-300" 
              : status.type === "info"
              ? "bg-blue-950/30 border-blue-900/60 text-blue-300"
              : "bg-rose-950/30 border-rose-900/60 text-rose-300"
          }`}>
            {status.type === "error" ? (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <Check className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-sans leading-relaxed">
              {status.message}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
