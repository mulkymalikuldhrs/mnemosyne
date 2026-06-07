import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://github.com/mulkymalikuldhrs/mnemosyne-ai'
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]
}
