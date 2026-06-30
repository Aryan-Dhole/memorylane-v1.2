import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import LenisProvider from "@/components/lenis-provider";
import GlobalShell from "@/components/global-shell";
import { AuthProvider } from "@/providers/AuthProvider";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MemoryLane — AI Premium Photo Books",
  description: "India's first AI-driven premium photo book platform. Curate, sequence, caption, and print your memories.",
  openGraph: {
    title: "MemoryLane — AI Premium Photo Books",
    description: "India's first AI-driven premium photo book platform. Curate, sequence, caption, and print your memories.",
    images: ["/og-image.jpg"],
    url: "https://yourdomain.com",
    type: "website"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LenisProvider>
          <AuthProvider>
            <GlobalShell>
              {children}
            </GlobalShell>
          </AuthProvider>
        </LenisProvider>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
