// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Auth Handoff & Token System
// Inspired by 9drive (https://github.com/mulkymalikuldhrs/9drive)
// Secure OAuth handoff, preview tokens, share tokens, and token refresh
// ═══════════════════════════════════════════════════════════════════════════════

import { randomToken, hashToken } from '@/lib/crypto'

// ─── Token Types ────────────────────────────────────────────────────────────────

export interface AuthHandoff {
  token: string
  tokenHash: string
  userId: string
  provider: string
  expiresAt: Date
  usedAt: Date | null
}

export interface PreviewToken {
  token: string
  tokenHash: string
  fileId: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export interface ShareToken {
  token: string
  tokenHash: string
  memoryId: string
  userId: string
  isEnabled: boolean
  createdAt: Date
}

// ─── In-Memory Token Stores (replace with Prisma in production) ─────────────────

const handoffStore = new Map<string, AuthHandoff>()
const previewStore = new Map<string, PreviewToken>()
const shareStore = new Map<string, ShareToken>()

// ─── Auth Handoff (inspired by 9drive's 3-step OAuth flow) ──────────────────────

/**
 * Create a one-time auth handoff token.
 * Used for OAuth callback flows where session tokens must not be exposed in URLs.
 *
 * Flow:
 * 1. OAuth callback creates handoff with one-time token
 * 2. Frontend receives handoff token in URL query parameter
 * 3. Frontend exchanges handoff for real session tokens via POST
 *
 * This prevents session tokens from leaking in URL logs, browser history, or referrer headers.
 */
export function createAuthHandoff(userId: string, provider: string, ttlMinutes = 5): AuthHandoff {
  const token = randomToken(32)
  const tokenHash = hashToken(token)
  const handoff: AuthHandoff = {
    token,
    tokenHash,
    userId,
    provider,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    usedAt: null,
  }
  handoffStore.set(tokenHash, handoff)
  return handoff
}

/**
 * Exchange an auth handoff token for the associated user ID.
 * One-time use: marks the token as used after successful exchange.
 */
export function exchangeAuthHandoff(token: string): { userId: string; provider: string } | null {
  const tokenHash = hashToken(token)
  const handoff = handoffStore.get(tokenHash)

  if (!handoff) return null
  if (handoff.usedAt) return null
  if (handoff.expiresAt < new Date()) {
    handoffStore.delete(tokenHash)
    return null
  }

  handoff.usedAt = new Date()
  setTimeout(() => handoffStore.delete(tokenHash), 5000)

  return { userId: handoff.userId, provider: handoff.provider }
}

// ─── Preview Tokens (inspired by 9drive's file preview system) ─────────────────

/**
 * Create a short-lived preview token for authenticated file/content streaming.
 * Preview tokens are one-time use and expire after 10 minutes.
 */
export function createPreviewToken(fileId: string, userId: string, ttlMinutes = 10): PreviewToken {
  const token = randomToken(24)
  const tokenHash = hashToken(token)
  const preview: PreviewToken = {
    token,
    tokenHash,
    fileId,
    userId,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    usedAt: null,
  }
  previewStore.set(tokenHash, preview)
  return preview
}

/**
 * Verify and consume a preview token.
 * Returns the associated file ID if valid, null otherwise.
 */
export function consumePreviewToken(token: string): { fileId: string; userId: string } | null {
  const tokenHash = hashToken(token)
  const preview = previewStore.get(tokenHash)

  if (!preview) return null
  if (preview.usedAt || preview.expiresAt < new Date()) {
    previewStore.delete(tokenHash)
    return null
  }

  preview.usedAt = new Date()
  setTimeout(() => previewStore.delete(tokenHash), 5000)

  return { fileId: preview.fileId, userId: preview.userId }
}

// ─── Share Tokens (inspired by 9drive's public share system) ───────────────────

/**
 * Create a persistent share token for a memory/note.
 * Share tokens remain valid until explicitly disabled.
 */
export function createShareToken(memoryId: string, userId: string): ShareToken {
  const token = randomToken(32)
  const tokenHash = hashToken(token)
  const share: ShareToken = {
    token,
    tokenHash,
    memoryId,
    userId,
    isEnabled: true,
    createdAt: new Date(),
  }
  shareStore.set(tokenHash, share)
  return share
}

/**
 * Verify a share token.
 * Returns the associated memory ID if valid and enabled, null otherwise.
 */
export function verifyShareToken(token: string): { memoryId: string; userId: string } | null {
  const tokenHash = hashToken(token)
  const share = shareStore.get(tokenHash)
  if (!share || !share.isEnabled) return null
  return { memoryId: share.memoryId, userId: share.userId }
}

/**
 * Disable a share token (soft delete).
 */
export function disableShareToken(token: string): boolean {
  const tokenHash = hashToken(token)
  const share = shareStore.get(tokenHash)
  if (!share) return false
  share.isEnabled = false
  return true
}

// ─── Cleanup ────────────────────────────────────────────────────────────────────

export function cleanupExpiredTokens(): { handoffs: number; previews: number } {
  const now = new Date()
  let handoffs = 0
  let previews = 0

  for (const [key, handoff] of handoffStore) {
    if (handoff.expiresAt < now || handoff.usedAt) {
      handoffStore.delete(key)
      handoffs++
    }
  }

  for (const [key, preview] of previewStore) {
    if (preview.expiresAt < now || preview.usedAt) {
      previewStore.delete(key)
      previews++
    }
  }

  return { handoffs, previews }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredTokens, 5 * 60 * 1000)
}
