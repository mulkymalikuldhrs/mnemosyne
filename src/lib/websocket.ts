// WebSocket Manager for Nanggroe IoT
// Provides real-time updates for telemetry, alerts, agent messages, and system status

export type WSEventType = 
  | 'telemetry'
  | 'alert'
  | 'agent_message'
  | 'mission_update'
  | 'hardware_change'
  | 'system_status'
  | 'safety_alert'
  | 'power_update'

export interface WSEvent {
  type: WSEventType
  payload: unknown
  timestamp: string
}

type EventHandler = (event: WSEvent) => void

class WebSocketManager {
  private ws: WebSocket | null = null
  private listeners: Map<WSEventType, Set<EventHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private url: string
  private isConnecting = false

  constructor(url?: string) {
    this.url = url || `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/ws`
  }

  connect(): void {
    if (typeof window === 'undefined' || this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return

    this.isConnecting = true

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.isConnecting = false
        this.emit({ type: 'system_status', payload: { status: 'connected' }, timestamp: new Date().toISOString() })
      }

      this.ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data)
          const handlers = this.listeners.get(data.type)
          if (handlers) {
            handlers.forEach(handler => handler(data))
          }
        } catch {
          // Ignore invalid messages
        }
      }

      this.ws.onclose = () => {
        this.isConnecting = false
        this.emit({ type: 'system_status', payload: { status: 'disconnected' }, timestamp: new Date().toISOString() })
        this.attemptReconnect()
      }

      this.ws.onerror = () => {
        this.isConnecting = false
      }
    } catch {
      this.isConnecting = false
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0 // Prevent reconnect
    this.ws?.close()
    this.ws = null
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    setTimeout(() => this.connect(), delay)
  }

  on(type: WSEventType, handler: EventHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler)

    // Auto-connect on first listener
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect()
    }

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(handler)
    }
  }

  off(type: WSEventType, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler)
  }

  private emit(event: WSEvent): void {
    const handlers = this.listeners.get(event.type)
    if (handlers) {
      handlers.forEach(handler => handler(event))
    }
  }

  send(type: WSEventType, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }))
    }
  }

  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'reconnecting' {
    if (this.isConnecting) return this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected'
    return 'disconnected'
  }
}

// Singleton
let _instance: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!_instance) {
    _instance = new WebSocketManager()
  }
  return _instance
}

export function useWebSocket(): WebSocketManager {
  return getWebSocketManager()
}
