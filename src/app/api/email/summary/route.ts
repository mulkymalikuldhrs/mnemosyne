// ============================================================
// MEMORIX v3.0.0 — Email Summary API
// GET /api/email/summary  — Get AI-generated summary of recent emails
//
// Query parameters:
//   - limit      (number)   Max emails to include in summary (default 25)
//   - afterDate  (ISO date) Only summarize emails after this date
//   - from       (string)   Comma-separated sender addresses to filter by
//   - labels     (string)   Comma-separated labels to filter by
//   - accountId  (string)   Filter by specific email account
//   - prompt     (string)   Custom prompt appended to the AI summariser
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailManager } from '@/lib/email'

// ============================================================
// GET /api/email/summary
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

    // Parse query parameters
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)),
      100
    )

    const afterDateStr = searchParams.get('afterDate')
    const afterDate = afterDateStr ? new Date(afterDateStr) : undefined

    // Validate date if provided
    if (afterDateStr && afterDate && isNaN(afterDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid afterDate parameter' },
        { status: 400 }
      )
    }

    const fromStr = searchParams.get('from')
    const fromAddresses = fromStr
      ? fromStr.split(',').map((addr) => addr.trim()).filter(Boolean)
      : undefined

    const labelsStr = searchParams.get('labels')
    const labels = labelsStr
      ? labelsStr.split(',').map((label) => label.trim()).filter(Boolean)
      : undefined

    const customPrompt = searchParams.get('prompt') ?? undefined

    // If accountId is specified, verify it belongs to this user
    const accountId = searchParams.get('accountId')
    if (accountId) {
      const account = await db.emailAccount.findFirst({
        where: { id: accountId, userId },
      })
      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Email account not found' },
          { status: 404 }
        )
      }
    }

    // Build the summary options
    const options: Parameters<EmailManager['summarizeEmails']>[1] = {
      limit,
      afterDate,
      fromAddresses,
      labels,
      customPrompt,
    }

    // Generate the summary via EmailManager
    const emailManager = EmailManager.getInstance()

    let summary: string
    try {
      summary = await emailManager.summarizeEmails(userId, options)
    } catch (summaryError) {
      const message =
        summaryError instanceof Error
          ? summaryError.message
          : 'Summary generation failed'
      return NextResponse.json(
        {
          success: false,
          error: `Email summary generation failed: ${message}`,
        },
        { status: 500 }
      )
    }

    // Count the emails that were considered for the summary
    const whereClause: Record<string, unknown> = { userId }
    if (accountId) {
      whereClause.emailAccountId = accountId
    }
    if (afterDate) {
      whereClause.date = { gte: afterDate }
    }
    if (fromAddresses && fromAddresses.length > 0) {
      whereClause.fromAddress = { in: fromAddresses }
    }

    const emailCount = await db.emailMessage.count({ where: whereClause })

    return NextResponse.json({
      success: true,
      data: {
        summary,
        emailCount,
        options: {
          limit,
          afterDate: afterDate?.toISOString() ?? null,
          fromAddresses: fromAddresses ?? [],
          labels: labels ?? [],
          hasCustomPrompt: !!customPrompt,
        },
      },
    })
  } catch (error) {
    console.error('GET /api/email/summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate email summary' },
      { status: 500 }
    )
  }
}
