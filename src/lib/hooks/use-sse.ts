// ============================================================
// NANGGROE IOT - Server-Sent Events Hook
// React hook for consuming SSE streams with auto-reconnect
// ============================================================

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface SSEOptions<T> {
  url: string
  enabled?: boolean
  onMessage?: (data: T) => void
}

interface SSEReturn<T> {
  data: T | null
  connected: boolean
  error: string | null
  reconnect: () => void
}

export function useSSE<T>(options: SSEOptions<T>): SSEReturn<T> {
  const { url, enabled = true, onMessage } = options
  const [data, setData] = useState<T | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectKey, setReconnectKey] = useState(0)
  const onMessageRef = useRef(onMessage)

  // Keep onMessage ref in sync without causing effect re-runs
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const reconnect = useCallback(() => {
    setReconnectKey(k => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as T
        setData(parsed)
        onMessageRef.current?.(parsed)
      } catch {
        // Ignore parse errors for non-JSON messages
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      setError('Connection lost — auto-reconnecting')
      // EventSource will auto-reconnect by default
    }

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [url, enabled, reconnectKey])

  return { data, connected, error, reconnect }
}
