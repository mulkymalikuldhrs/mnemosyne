/**
 * Error reporting utility for Memorix AI Memory SaaS.
 * Logs structured error information to console with context.
 * Can be extended to send errors to external services (Sentry, etc.) in production.
 */

interface ErrorReport {
  message: string
  stack?: string
  context?: Record<string, unknown>
  timestamp: string
  severity: 'error' | 'warning' | 'info'
}

/**
 * Report an error with optional context.
 * In production, this could be extended to send to Sentry, DataDog, etc.
 */
export function reportError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    severity: 'error',
  }

  // Console logging (always available)
  console.error('[Memorix Error]', JSON.stringify(report, null, 2))

  // In production, you could add external reporting here:
  // - Sentry.captureException(error, { extra: context })
  // - DataDog.logger.error(error.message, { error, ...context })
}

/**
 * Create a standardized API error handler for a specific route handler.
 * Returns a function that logs the error and returns an appropriate response.
 *
 * Usage:
 * ```ts
 * const handleApiError = createApiErrorHandler('POST /api/notes')
 * try { ... } catch (error) { return handleApiError(error) }
 * ```
 */
export function createApiErrorHandler(handler: string) {
  return (error: unknown): Response => {
    const err = error instanceof Error ? error : new Error(String(error))

    reportError(err, {
      handler,
      type: 'api_error',
    })

    // Don't leak internal error details in production
    const isDev = process.env.NODE_ENV === 'development'
    const message = isDev ? err.message : 'Internal server error'

    return Response.json(
      {
        success: false,
        error: message,
        ...(isDev && { stack: err.stack }),
      },
      { status: 500 }
    )
  }
}

/**
 * Report a warning (non-critical issue).
 */
export function reportWarning(
  message: string,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    message,
    context,
    timestamp: new Date().toISOString(),
    severity: 'warning',
  }

  console.warn('[Memorix Warning]', JSON.stringify(report, null, 2))
}

/**
 * Report an info message for auditing purposes.
 */
export function reportInfo(
  message: string,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    message,
    context,
    timestamp: new Date().toISOString(),
    severity: 'info',
  }

  console.info('[Memorix Info]', JSON.stringify(report, null, 2))
}
