// ============================================================
// MEMORIX IOT - Extension Bridge API
// GET    /api/extension — List connected extensions, capabilities, events
// POST   /api/extension — Register new extension, send command
// PUT    /api/extension — Authenticate extension, update extension
// DELETE /api/extension — Unregister extension
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { ExtensionBridge } from '@/lib/extension'
import type { CompletionContext, Position } from '@/lib/extension'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const connectionId = searchParams.get('connectionId')

    const bridge = ExtensionBridge.getInstance()

    // Get event log
    if (action === 'events') {
      const limit = parseInt(searchParams.get('limit') || '50')
      const events = bridge.getEventLog(limit)
      return NextResponse.json({
        success: true,
        data: events,
      })
    }

    // Get command history
    if (action === 'commands') {
      const limit = parseInt(searchParams.get('limit') || '50')
      const commands = bridge.getCommandHistory(limit)
      return NextResponse.json({
        success: true,
        data: commands,
      })
    }

    // Get specific extension details
    if (action === 'detail' && connectionId) {
      const connections = await bridge.listConnections()
      const connection = connections.find(c => c.id === connectionId)
      if (!connection) {
        return NextResponse.json(
          { success: false, error: 'Extension connection not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        data: connection,
      })
    }

    // Get completions for an extension
    if (action === 'completions' && connectionId) {
      const filePath = searchParams.get('filePath') || ''
      const line = parseInt(searchParams.get('line') || '0')
      const column = parseInt(searchParams.get('column') || '0')
      const prefix = searchParams.get('prefix') || ''
      const language = searchParams.get('language') || 'typescript'

      const context: CompletionContext = {
        filePath,
        line,
        column,
        prefix,
        language,
        triggerKind: 'invoked',
      }

      const completions = await bridge.provideCompletions(connectionId, context)
      return NextResponse.json({
        success: true,
        data: completions,
      })
    }

    // Get hover info for an extension
    if (action === 'hover' && connectionId) {
      const filePath = searchParams.get('filePath') || ''
      const line = parseInt(searchParams.get('line') || '0')
      const column = parseInt(searchParams.get('column') || '0')

      const position: Position = { filePath, line, column }
      const hover = await bridge.provideHover(connectionId, position)

      return NextResponse.json({
        success: true,
        data: hover,
      })
    }

    // Default: list all connected extensions
    const connections = await bridge.listConnections()

    // Aggregate capability info
    const capabilities = connections.reduce<Record<string, number>>((acc, conn) => {
      for (const cap of conn.capabilities) {
        acc[cap] = (acc[cap] || 0) + 1
      }
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        connections,
        totalConnections: connections.length,
        connectedCount: connections.filter(c => c.connected).length,
        capabilities,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve extension information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const bridge = ExtensionBridge.getInstance()

    // Register new extension
    if (action === 'register') {
      const { name, type, apiKey } = body as {
        name: string
        type: string
        apiKey?: string
      }

      if (!name || !type) {
        return NextResponse.json(
          { success: false, error: 'name and type are required' },
          { status: 400 }
        )
      }

      const validTypes = ['vscode', 'jetbrains', 'vim', 'custom']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }

      const connection = bridge.registerExtension(name, type, apiKey)

      return NextResponse.json({
        success: true,
        data: connection,
        message: `Extension "${name}" registered successfully. Save the apiKey — it will not be shown again.`,
      }, { status: 201 })
    }

    // Send command to extension
    if (action === 'command') {
      const { connectionId, command, payload } = body as {
        connectionId: string
        command: string
        payload?: unknown
      }

      if (!connectionId || !command) {
        return NextResponse.json(
          { success: false, error: 'connectionId and command are required' },
          { status: 400 }
        )
      }

      try {
        const result = await bridge.sendCommand(connectionId, command, payload)
        return NextResponse.json({
          success: true,
          data: result,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Command failed'
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        )
      }
    }

    // Broadcast event to all extensions
    if (action === 'broadcast') {
      const { event, data } = body as {
        event: string
        data?: unknown
      }

      if (!event) {
        return NextResponse.json(
          { success: false, error: 'event is required' },
          { status: 400 }
        )
      }

      await bridge.broadcastEvent(event, data)

      return NextResponse.json({
        success: true,
        message: `Event "${event}" broadcast to all extensions`,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "register", "command", or "broadcast"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process extension request' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const bridge = ExtensionBridge.getInstance()

    // Authenticate extension
    if (action === 'authenticate') {
      const { apiKey } = body as { apiKey: string }

      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'apiKey is required' },
          { status: 400 }
        )
      }

      const connection = await bridge.authenticate(apiKey)

      if (!connection) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        success: true,
        data: connection,
        message: `Extension "${connection.name}" authenticated successfully`,
      })
    }

    // Update extension connection status
    if (action === 'update') {
      const { connectionId, connected } = body as {
        connectionId: string
        connected?: boolean
      }

      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: 'connectionId is required' },
          { status: 400 }
        )
      }

      const connections = await bridge.listConnections()
      const connection = connections.find(c => c.id === connectionId)

      if (!connection) {
        return NextResponse.json(
          { success: false, error: 'Extension connection not found' },
          { status: 404 }
        )
      }

      // If setting disconnected, we update the connection state
      // The bridge manages the connected state internally
      if (connected === false) {
        // In a real implementation, this would send a disconnect signal
        return NextResponse.json({
          success: true,
          message: `Extension "${connection.name}" marked as disconnected`,
        })
      }

      return NextResponse.json({
        success: true,
        data: connection,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "authenticate" or "update"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process extension update' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'connectionId query parameter is required' },
        { status: 400 }
      )
    }

    const bridge = ExtensionBridge.getInstance()
    const connections = await bridge.listConnections()
    const connection = connections.find(c => c.id === connectionId)

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Extension connection not found' },
        { status: 404 }
      )
    }

    bridge.unregisterExtension(connectionId)

    return NextResponse.json({
      success: true,
      message: `Extension "${connection.name}" unregistered successfully`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to unregister extension' },
      { status: 500 }
    )
  }
}
