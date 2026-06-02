import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Validate an API key against the database.
 *
 * Overload 1: Pass a string API key → returns userId or null
 * Overload 2: Pass a NextRequest → extracts API key from header, returns NextResponse error or null
 */
export async function validateApiKey(apiKey: string): Promise<string | null>
export async function validateApiKey(request: NextRequest): Promise<NextResponse | null>
export async function validateApiKey(input: string | NextRequest): Promise<string | NextResponse | null> {
  // If input is a NextRequest, extract the API key from the Authorization header
  if (typeof input !== 'string') {
    const authHeader = input.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '') || input.headers.get('x-api-key') || null
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header.' },
        { status: 401 }
      )
    }
    const userId = await validateApiKeyString(apiKey)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }
    return null // No error = authenticated
  }

  // String overload
  return validateApiKeyString(input)
}

async function validateApiKeyString(apiKey: string): Promise<string | null> {
  if (!apiKey) return null
  const keyRecord = await db.apiKey.findUnique({
    where: { key: apiKey },
    select: { userId: true },
  })
  if (!keyRecord) return null
  // Update lastUsedAt
  await db.apiKey.update({
    where: { key: apiKey },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})
  return keyRecord.userId
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'demo@memorix.ai' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          return null
        }

        // User must have a password to authenticate with credentials
        if (!user.password) {
          // OAuth-only user cannot log in via credentials
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.plan = (user as { plan?: string }).plan ?? 'FREE'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { plan?: string }).plan = token.plan as string
      }
      return session
    },
  },
}
