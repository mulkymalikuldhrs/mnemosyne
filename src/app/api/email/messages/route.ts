// ============================================================
// MEMORIX v3.0.0 — Email Messages API
// GET  /api/email/messages  — List email messages (pagination, filters, search)
// POST /api/email/messages  — Send an email
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailManager, type EmailAddress } from '@/lib/email'
import { z } from 'zod'

// --- Validation Schema ---

const sendEmailSchema = z.object({
  emailAccountId: z.string().min(1, 'Email account ID is required'),
  to: z.array(z.object({
    address: z.string().email('Invalid recipient email'),
    name: z.string().optional(),
  })).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required').max(1000),
  body: z.string().min(1, 'Email body is required').max(500000),
  isHtml: z.boolean().optional().default(false),
})

// ============================================================
// GET /api/email/messages
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)), 100)
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = { userId }

    // Filter by account
    const accountId = searchParams.get('accountId')
    if (accountId) {
      where.emailAccountId = accountId
    }

    // Search filter (subject, from, body)
    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
        { fromName: { contains: search } },
        { bodyText: { contains: search } },
        { snippet: { contains: search } },
      ]
    }

    // Starred filter
    const starred = searchParams.get('starred')
    if (starred === 'true') {
      where.isStarred = true
    } else if (starred === 'false') {
      where.isStarred = false
    }

    // Read filter
    const unread = searchParams.get('unread')
    if (unread === 'true') {
      where.isRead = false
    }

    // Date range filter
    const afterDate = searchParams.get('afterDate')
    const beforeDate = searchParams.get('beforeDate')
    if (afterDate || beforeDate) {
      const dateFilter: Record<string, Date> = {}
      if (afterDate) {
        dateFilter.gte = new Date(afterDate)
      }
      if (beforeDate) {
        dateFilter.lte = new Date(beforeDate)
      }
      where.date = dateFilter
    }

    // Ingested filter
    const ingested = searchParams.get('ingested')
    if (ingested === 'true') {
      where.isIngested = true
    } else if (ingested === 'false') {
      where.isIngested = false
    }

    const [messages, total] = await Promise.all([
      db.emailMessage.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          emailAccountId: true,
          messageId: true,
          fromAddr: true,
          fromAddress: true,
          fromName: true,
          toAddr: true,
          toAddresses: true,
          subject: true,
          snippet: true,
          date: true,
          isRead: true,
          isStarred: true,
          isIngested: true,
          labels: true,
          noteId: true,
          ingestedAt: true,
          createdAt: true,
          // Deliberately exclude bodyText and bodyHtml for list view (performance)
          emailAccount: {
            select: {
              id: true,
              provider: true,
              email: true,
              displayName: true,
            },
          },
        },
      }),
      db.emailMessage.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/email/messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email messages' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/email/messages
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = sendEmailSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { emailAccountId, to, subject, body: emailBody, isHtml } = parsed.data

    // Verify the email account belongs to this user
    const account = await db.emailAccount.findFirst({
      where: { id: emailAccountId, userId },
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      )
    }

    if (!account.isEnabled) {
      return NextResponse.json(
        { success: false, error: 'Email account is disabled' },
        { status: 400 }
      )
    }

    // Send the email via the EmailManager
    const emailManager = EmailManager.getInstance()

    try {
      const provider = await emailManager.getProvider(
        account.provider as 'gmail' | 'imap' | 'outlook',
        emailAccountId,
        {
          provider: account.provider as 'gmail' | 'imap' | 'outlook',
          emailAddress: account.emailAddress || account.email,
          displayName: account.displayName,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          imapHost: account.imapHost ?? undefined,
          imapPort: account.imapPort ?? undefined,
          smtpHost: account.smtpHost ?? undefined,
          smtpPort: account.smtpPort ?? undefined,
        }
      )

      const recipients: EmailAddress[] = to.map((r) => ({
        address: r.address,
        name: r.name,
      }))

      await provider.sendMessage(recipients, subject, emailBody, isHtml)
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send email'
      return NextResponse.json(
        { success: false, error: `Email send failed: ${message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          sent: true,
          emailAccountId,
          to: to.map((r) => r.address),
          subject,
          isHtml,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/email/messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
