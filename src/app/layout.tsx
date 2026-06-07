import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from '@/components/providers'
import { PWARegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: 'Mnemosyne — Universal AI Memory & LLM Hub',
  description: 'The biggest free multi-LLM hub — memory, AI agent, BYOK, semantic search, RAG, MCP, multi-cloud storage, SaaS/IaaS ready.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
    shortcut: '/logo.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mnemosyne',
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: 'Mnemosyne',
  openGraph: {
    title: 'Mnemosyne — Universal AI Memory & LLM Hub',
    description: 'The biggest free multi-LLM hub — memory, AI agent, BYOK, and more.',
    type: 'website',
    siteName: 'Mnemosyne',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#8b5cf6',
    'msapplication-tap-highlight': 'no',
  },
}

export const viewport: Viewport = {
  themeColor: '#8b5cf6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/logo.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
          <PWARegister />
        </Providers>
      </body>
    </html>
  )
}
