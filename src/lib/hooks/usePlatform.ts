'use client'

import { useSyncExternalStore, useCallback } from 'react'

export type PlatformType = 'web' | 'android' | 'linux' | 'windows' | 'ios'

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function getPlatformSnapshot() {
  if (typeof window === 'undefined') {
    return {
      isNative: false,
      isCapacitor: false,
      isTauri: false,
      platform: 'web' as PlatformType,
      isMobile: false,
      isDesktop: true,
      isAndroid: false,
      isIOS: false,
      isWeb: true,
    }
  }

  let isNative = false
  let isCapacitor = false
  let isTauri = false
  let platform: PlatformType = 'web'

  // Check if running in Capacitor (Android/iOS)
  const capacitor = (window as any).Capacitor
  if (capacitor?.isNativePlatform?.()) {
    isNative = true
    isCapacitor = true
    const platformName = capacitor.getPlatform()
    if (platformName === 'android') {
      platform = 'android'
    } else if (platformName === 'ios') {
      platform = 'ios'
    }
  }

  // Check if running in Tauri (Desktop)
  if ((window as any).__TAURI__) {
    isTauri = true
    isNative = true
    const tauriPlatform = (window as any).__TAURI_PLATFORM__
    if (tauriPlatform === 'linux') {
      platform = 'linux'
    } else if (tauriPlatform === 'windows') {
      platform = 'windows'
    }
  }

  const isMobile = window.innerWidth < 768 || platform === 'android' || platform === 'ios'

  return {
    isNative,
    isCapacitor,
    isTauri,
    platform,
    isMobile,
    isDesktop: !isMobile,
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isWeb: platform === 'web',
  }
}

function getServerSnapshot() {
  return {
    isNative: false,
    isCapacitor: false,
    isTauri: false,
    platform: 'web' as PlatformType,
    isMobile: false,
    isDesktop: true,
    isAndroid: false,
    isIOS: false,
    isWeb: true,
  }
}

export function usePlatform() {
  return useSyncExternalStore(subscribe, getPlatformSnapshot, getServerSnapshot)
}
