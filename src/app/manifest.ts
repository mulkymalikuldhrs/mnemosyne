import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Memorix AI Memory',
    short_name: 'Memorix',
    description: 'Personal AI Memory Infrastructure',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#14b8a6',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
