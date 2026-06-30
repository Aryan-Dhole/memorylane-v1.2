import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memorylane.in'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/create/', '/checkout/', '/orders/', '/dashboard/', '/admin/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
