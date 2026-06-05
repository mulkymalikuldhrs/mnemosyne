'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getWebSocketManager, type WSEvent, type WSEventType } from '@/lib/websocket'

export function useWSEvent<T = unknown>(type: WSEventType): T | null {
  const [data, setData] = useState<T | null>(null)
  const wsRef = useRef(getWebSocketManager())

  useEffect(() => {
    const unsubscribe = wsRef.current.on(type, (event: WSEvent) => {
      setData(event.payload as T)
    })
    return unsubscribe
  }, [type])

  return data
}

export function useWSStatus(): 'connecting' | 'connected' | 'disconnected' | 'reconnecting' {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const wsRef = useRef(getWebSocketManager())

  useEffect(() => {
    const unsubscribe = wsRef.current.on('system_status', (event: WSEvent) => {
      setStatus(event.payload as 'connecting' | 'connected' | 'disconnected' | 'reconnecting')
    })

    // Initial status
    setStatus(wsRef.current.getStatus())

    return unsubscribe
  }, [])

  return status
}

export function useWSSend() {
  const wsRef = useRef(getWebSocketManager())

  return useCallback((type: WSEventType, payload: unknown) => {
    wsRef.current.send(type, payload)
  }, [])
}
