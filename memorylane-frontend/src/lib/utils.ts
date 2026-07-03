import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resizeAndCompressImage(
  file: File,
  maxW = 1600,
  maxH = 1600,
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.HTMLCanvasElement) {
      resolve(file)
      return
    }
    if (!file.type.startsWith("image/")) {
      resolve(file)
      return
    }
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width)
            width = maxW
          } else {
            width = Math.round((width * maxH) / height)
            height = maxH
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            resolve(blob || file)
          },
          "image/jpeg",
          quality
        )
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}
