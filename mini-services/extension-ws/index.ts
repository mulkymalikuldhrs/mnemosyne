// ============================================================
// NANGGROE IOT - Extension WebSocket Server
// Port 3004 — Real-time push to connected IDE extensions
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'

const EXTENSION_WS_PORT = 3004

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', connections: io.sockets.sockets.size }))
    return
  }

  // POST /broadcast — allows Next.js API routes to push events
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const payload = JSON.parse(body)
        const { event, data, targetConnectionId } = payload as {
          event: string
          data?: unknown
          targetConnectionId?: string
        }

        if (!event) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'event is required' }))
          return
        }

        if (targetConnectionId) {
          // Send to a specific connection
          io.to(targetConnectionId).emit(event, data)
        } else {
          // Broadcast to all connected extensions
          io.emit(event, data)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          event,
          recipients: targetConnectionId ? 1 : io.sockets.sockets.size,
        }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Track which socket belongs to which extension connection
const socketConnectionMap = new Map<string, string>() // socketId -> connectionId

io.on('connection', (socket) => {
  console.log(`[Extension WS] Client connected: ${socket.id}`)

  // Extension identifies itself after connecting
  socket.on('identify', (data: { connectionId: string; apiKey: string }) => {
    const { connectionId } = data
    socketConnectionMap.set(socket.id, connectionId)
    // Join a room specific to this connection ID for targeted messages
    socket.join(connectionId)
    console.log(`[Extension WS] Socket ${socket.id} identified as extension ${connectionId}`)
  })

  // Handle extension commands coming from the IDE
  socket.on('command', (data: { connectionId: string; command: string; payload?: unknown }, callback) => {
    console.log(`[Extension WS] Command from ${data.connectionId}: ${data.command}`)
    // Forward to the main app via event for any listening consumers
    io.emit('extension:command', data)
    if (callback) {
      callback({ received: true, timestamp: new Date().toISOString() })
    }
  })

  // Handle extension heartbeat
  socket.on('heartbeat', (data: { connectionId: string }, callback) => {
    if (callback) {
      callback({ received: true, timestamp: new Date().toISOString() })
    }
  })

  socket.on('disconnect', (reason) => {
    const connectionId = socketConnectionMap.get(socket.id)
    if (connectionId) {
      console.log(`[Extension WS] Extension ${connectionId} disconnected: ${reason}`)
      socketConnectionMap.delete(socket.id)
      // Notify others about disconnect
      io.emit('extension:disconnected', { connectionId, reason })
    } else {
      console.log(`[Extension WS] Client disconnected: ${socket.id} (${reason})`)
    }
  })

  socket.on('error', (error: Error) => {
    console.error(`[Extension WS] Socket error (${socket.id}):`, error)
  })
})

httpServer.listen(EXTENSION_WS_PORT, () => {
  console.log(`[Extension WS] Server running on port ${EXTENSION_WS_PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Extension WS] SIGTERM received, shutting down...')
  io.close()
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[Extension WS] SIGINT received, shutting down...')
  io.close()
  httpServer.close(() => process.exit(0))
})
