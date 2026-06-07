import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mnemosyne — Universal AI Memory & LLM Hub',
    short_name: 'Mnemosyne',
    description: 'The biggest free multi-LLM hub — memory, AI agent, BYOK, semantic search, RAG, MCP, multi-cloud storage, SaaS/IaaS ready.',
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
