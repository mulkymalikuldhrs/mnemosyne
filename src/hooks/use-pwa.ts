'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  /** Whether the app is running as an installed PWA */
  isInstalled: boolean
  /** Whether the device is currently online */
  isOnline: boolean
  /** Whether the app can be installed (beforeinstallprompt available) */
  canInstall: boolean
  /** Whether a service worker update is available */
  updateAvailable: boolean
  /** The current service worker registration */
  registration: ServiceWorkerRegistration | null
  /** Trigger the install prompt for the PWA */
  promptInstall: () => Promise<boolean>
  /** Apply the pending service worker update */
  applyUpdate: () => void
}

// ─── Online status via useSyncExternalStore ───────────────────────────────────
function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getOnlineServerSnapshot() {
  return true // SSR always assumes online
}

// ─── Installed status via useSyncExternalStore ────────────────────────────────
function subscribeInstalled(callback: () => void) {
  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getInstalledSnapshot() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

function getInstalledServerSnapshot() {
  return false
}

export function usePWA(): PWAState {
  // Use useSyncExternalStore for values that don't need setState in effects
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot)
  const isInstalled = useSyncExternalStore(subscribeInstalled, getInstalledSnapshot, getInstalledServerSnapshot)

  const [canInstall, setCanInstall] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  // ─── Handle beforeinstallprompt event ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the default mini-infobar
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  // ─── Handle appinstalled event ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setCanInstall(false)
      setInstallPrompt(null)
    }

    window.addEventListener('appinstalled', handler)

    return () => {
      window.removeEventListener('appinstalled', handler)
    }
  }, [])

  // ─── Register service worker ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        setRegistration(reg)

        // Check for updates on load
        reg.update()

        // Handle updating service worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                setUpdateAvailable(true)
                setWaitingWorker(newWorker)
              } else {
                // First install — content cached for offline use
                console.log('[Mnemosyne PWA] Content cached for offline use')
              }
            }
          })
        })

        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[Mnemosyne PWA] Service worker controller changed')
        })
      } catch (error) {
        console.warn('[Mnemosyne PWA] Service worker registration failed:', error)
      }
    }

    registerSW()
  }, [])

  // ─── Prompt install ──────────────────────────────────────────────────────────
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setCanInstall(false)
      }

      // Clear the prompt — it can only be used once
      setInstallPrompt(null)
      setCanInstall(false)

      return outcome === 'accepted'
    } catch (error) {
      console.warn('[Mnemosyne PWA] Install prompt failed:', error)
      return false
    }
  }, [installPrompt])

  // ─── Apply service worker update ─────────────────────────────────────────────
  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return

    // Tell the waiting service worker to skip waiting and activate
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    // Reload the page to use the new service worker
    window.location.reload()
  }, [waitingWorker])

  return {
    isInstalled,
    isOnline,
    canInstall,
    updateAvailable,
    registration,
    promptInstall,
    applyUpdate,
  }
}
