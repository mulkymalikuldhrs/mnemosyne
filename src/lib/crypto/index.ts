// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Crypto Utilities
// Adapted from 9drive (https://github.com/mulkymalikuldhrs/9drive)
// AES-256-GCM encryption/decryption, token generation, and hashing
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dev-encryption-key-change-in-production'

function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptText(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * Decrypt a string encrypted with encryptText()
 * Input format: iv:authTag:ciphertext (all base64)
 */
export function decryptText(encryptedValue: string): string {
  const key = getKey()
  const [ivRaw, tagRaw, encryptedRaw] = encryptedValue.split(':')
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted value format')
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Generate a cryptographically secure random token
 */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/**
 * Hash a token using SHA-256
 * Used for storing API keys, share tokens, handoff tokens
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify a token against a SHA-256 hash
 */
export function verifyToken(token: string, hash: string): boolean {
  return hashToken(token) === hash
}

/**
 * Hash a password using bcrypt-style scrypt (Node.js native)
 * Falls back to SHA-256 if bcryptjs is not available
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return hash === verifyHash
}

/**
 * Generate an MD5 hash (for memory deduplication, inspired by mem0)
 */
export function md5Hash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}
