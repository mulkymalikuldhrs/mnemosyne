'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Wifi, WifiOff, RefreshCw, X, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePWA } from '@/hooks/use-pwa'

export function PWARegister() {
  const { isInstalled, isOnline, canInstall, updateAvailable, promptInstall, applyUpdate } = usePWA()
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [wasOnline, setWasOnline] = useState(true)
  const [isInstalling, setIsInstalling] = useState(false)

  // Show install banner when available (after a brief delay so it doesn't appear immediately)
  useEffect(() => {
    if (canInstall && !isInstalled) {
      const timer = setTimeout(() => setShowInstallBanner(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [canInstall, isInstalled])

  // Show update banner when update is available
  useEffect(() => {
    if (updateAvailable) {
      setShowUpdateBanner(true)
    }
  }, [updateAvailable])

  // Show offline/online status indicator
  useEffect(() => {
    if (!isOnline && wasOnline) {
      setShowOfflineToast(true)
      setWasOnline(false)
    } else if (isOnline && !wasOnline) {
      setShowOfflineToast(true)
      setWasOnline(true)
      // Auto-dismiss the online toast after 2 seconds
      const timer = setTimeout(() => setShowOfflineToast(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOnline])

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      const accepted = await promptInstall()
      if (accepted) {
        setShowInstallBanner(false)
      }
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUpdate = () => {
    applyUpdate()
  }

  return (
    <>
      {/* ── Install Banner ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInstallBanner && canInstall && !isInstalled && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50"
          >
            <div className="rounded-xl border border-border bg-card/95 backdrop-blur-lg shadow-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Install Memorix</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add to home screen for a faster, app-like experience with offline support.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleInstall} disabled={isInstalling} className="h-7 text-xs">
                      {isInstalling ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      Install
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInstallBanner(false)}
                      className="h-7 text-xs"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 -mt-1 -mr-1"
                  onClick={() => setShowInstallBanner(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Update Banner ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUpdateBanner && updateAvailable && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50"
          >
            <div className="rounded-xl border border-primary/20 bg-card/95 backdrop-blur-lg shadow-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Update Available</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A new version of Memorix is ready. Update to get the latest features.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleUpdate} className="h-7 text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Update Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowUpdateBanner(false)}
                      className="h-7 text-xs"
                    >
                      Later
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 -mt-1 -mr-1"
                  onClick={() => setShowUpdateBanner(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Offline/Online Status Toast ────────────────────────────────────── */}
      <AnimatePresence>
        {showOfflineToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg backdrop-blur-lg ${
                isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span className="text-xs font-medium">Back online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span className="text-xs font-medium">You&apos;re offline — cached data available</span>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1"
                onClick={() => setShowOfflineToast(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Persistent Status Indicator (when offline) ─────────────────────── */}
      <AnimatePresence>
        {!isOnline && !showOfflineToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-4 right-4 z-40"
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-500">Offline</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
