import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { createApiErrorHandler } from '@/lib/error-reporter'

const handleApiError = createApiErrorHandler('POST /api/auth/register')

// Registration input validation schema
const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return Response.json(
        {
          success: false,
          error: firstError?.message || 'Invalid input',
        },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return Response.json(
        {
          success: false,
          error: 'An account with this email already exists',
        },
        { status: 409 }
      )
    }

    // Hash password with bcryptjs (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        plan: 'FREE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
      },
    })

    return Response.json(
      {
        success: true,
        data: {
          user,
          message: 'Account created successfully. You can now sign in.',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
