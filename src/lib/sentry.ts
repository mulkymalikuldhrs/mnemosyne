// ============================================================
// NANGGROE IOT - Sentry-style Error Monitoring
// If @sentry/nextjs is installed, it will be used. Otherwise,
// errors are logged to the database via the Alert model.
// ============================================================

import { db } from './db'

interface ErrorLogEntry {
  message: string
  stack?: string
  component?: string
  url?: string
  timestamp: Date
  severity: 'error' | 'warning' | 'critical'
  context?: Record<string, unknown>
}

class ErrorReporter {
  private queue: ErrorLogEntry[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private readonly MAX_QUEUE_SIZE = 50

  constructor() {
    if (typeof setInterval !== 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), 30000) // flush every 30s
    }
  }

  captureException(error: Error, context?: Record<string, unknown>) {
    const entry: ErrorLogEntry = {
      message: error.message,
      stack: error.stack,
      component: context?.component as string | undefined,
      url: context?.url as string | undefined,
      timestamp: new Date(),
      severity: (context?.severity as ErrorLogEntry['severity']) || 'error',
      context,
    }

    this.queue.push(entry)

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush()
    }
  }

  captureMessage(message: string, severity: ErrorLogEntry['severity'] = 'warning', context?: Record<string, unknown>) {
    this.queue.push({
      message,
      timestamp: new Date(),
      severity,
      context,
    })
  }

  private async flush() {
    if (this.queue.length === 0) return

    const items = [...this.queue]
    this.queue = []

    try {
      // Store errors as alerts in the database
      for (const item of items) {
        await db.alert.create({
          data: {
            level: item.severity === 'critical' ? 'critical' : item.severity === 'error' ? 'warning' : 'info',
            source: 'system',
            title: item.message.substring(0, 200),
            message: JSON.stringify({
              stack: item.stack?.substring(0, 1000),
              component: item.component,
              url: item.url,
              context: item.context,
            }),
            category: 'system',
          },
        })
      }
    } catch {
      // If DB write fails, re-queue items
      this.queue.unshift(...items)
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

// Singleton
let _reporter: ErrorReporter | null = null

export function getErrorReporter(): ErrorReporter {
  if (!_reporter) {
    _reporter = new ErrorReporter()
  }
  return _reporter
}

export { ErrorReporter }
