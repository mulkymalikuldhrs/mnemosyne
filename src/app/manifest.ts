import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nanggroe IoT',
    short_name: 'NanggroeIoT',
    description: 'Modular IoT & Robotics Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#14b8a6',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
