import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const subscriptionCreateSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise', 'iaas']),
  stripeCustomerId: z.string().optional(),
  stripePriceId: z.string().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
})

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get the most recent active subscription
    const subscription = await db.subscription.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    // If no subscription record exists, return free-tier default
    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          plan: 'free',
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: null,
          stripePriceId: null,
          features: getPlanFeatures('free'),
          isDefault: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        stripeCustomerId: subscription.stripeCustomerId,
        stripePriceId: subscription.stripePriceId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        features: getPlanFeatures(subscription.plan as 'free' | 'pro' | 'enterprise' | 'iaas'),
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isDefault: false,
      },
    })
  } catch (error) {
    console.error('GET /api/subscription error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}

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

    const parsed = subscriptionCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const {
      plan,
      stripeCustomerId,
      stripePriceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    } = parsed.data

    // Check for existing active subscription
    const existing = await db.subscription.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      // Upgrade/downgrade: mark existing as canceled and create new
      await db.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'canceled',
          cancelAtPeriodEnd: true,
        },
      })
    }

    // Create new subscription
    const subscription = await db.subscription.create({
      data: {
        userId,
        plan,
        status: 'active',
        stripeCustomerId: stripeCustomerId ?? null,
        stripePriceId: stripePriceId ?? null,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : new Date(),
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
      },
    })

    // Update user plan to match subscription
    await db.user.update({
      where: { id: userId },
      data: { plan: plan.toUpperCase() },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          stripeCustomerId: subscription.stripeCustomerId,
          stripePriceId: subscription.stripePriceId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          features: getPlanFeatures(plan),
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/subscription error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

function getPlanFeatures(plan: 'free' | 'pro' | 'enterprise' | 'iaas') {
  const features = {
    free: {
      maxNotes: 100,
      maxEntities: 50,
      maxAgents: 1,
      maxIntegrations: 2,
      temporalSnapshots: false,
      mcpAccess: false,
      prioritySupport: false,
    },
    pro: {
      maxNotes: 10000,
      maxEntities: 5000,
      maxAgents: 10,
      maxIntegrations: 20,
      temporalSnapshots: true,
      mcpAccess: true,
      prioritySupport: false,
    },
    enterprise: {
      maxNotes: -1,
      maxEntities: -1,
      maxAgents: -1,
      maxIntegrations: -1,
      temporalSnapshots: true,
      mcpAccess: true,
      prioritySupport: true,
    },
    iaas: {
      maxNotes: -1,
      maxEntities: -1,
      maxAgents: -1,
      maxIntegrations: -1,
      temporalSnapshots: true,
      mcpAccess: true,
      prioritySupport: true,
    },
  }

  return features[plan]
}
