import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Memorix — Universal AI Memory Hub',
    short_name: 'Memorix',
    description: 'The central memory hub for AI agents and humans. Semantic memory, RAG, MCP, multi-cloud storage, email, and more.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#8b5cf6',
    orientation: 'any',
    scope: '/',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    categories: ['productivity', 'utilities', 'business'],
    screenshots: [],
    prefer_related_applications: false,
  }
}
