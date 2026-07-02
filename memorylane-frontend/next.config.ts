import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      apiUrl = `https://${apiUrl}`;
    }
    apiUrl = apiUrl.replace(/\/$/, "");
    return [
      {
        source: "/upload/mock-s3/:path*",
        destination: `${apiUrl}/upload/mock-s3/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "memorylane-photos.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      }
    ]
  }
};

export default nextConfig;
