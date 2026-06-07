import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to')     // YYYY-MM-DD

  const where: any = { userId: session.user.id }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }

  const dailyNotes = await db.dailyNote.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 100,
  })

  return NextResponse.json({ success: true, data: { dailyNotes } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { date, content, markdown } = body

  if (!date) {
    return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 })
  }

  const dailyNote = await db.dailyNote.upsert({
    where: {
      userId_date: {
        userId: session.user.id,
        date,
      },
    },
    create: {
      userId: session.user.id,
      date,
      content: content || '',
      markdown: markdown || '',
    },
    update: {
      content: content || '',
      markdown: markdown || '',
    },
  })

  return NextResponse.json({ success: true, data: dailyNote })
}
