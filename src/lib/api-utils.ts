import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Require authentication for an API route.
 * Returns the session if authenticated, or null if not.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session
}

/**
 * Return a success JSON response with data.
 */
export function successResponse(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status })
}

/**
 * Return an error JSON response with a message.
 */
export function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

/**
 * Return a 401 Unauthorized response.
 */
export function unauthorizedResponse() {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

/**
 * Return a 404 Not Found response.
 */
export function notFoundResponse(resource = 'Resource') {
  return Response.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  )
}

/**
 * Return a 429 Too Many Requests response with rate limit headers.
 */
export function rateLimitResponse(resetAt: number) {
  return Response.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  )
}

/**
 * Return a 403 Forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden') {
  return Response.json({ success: false, error: message }, { status: 403 })
}
