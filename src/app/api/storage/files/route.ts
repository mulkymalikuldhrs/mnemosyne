import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'
import { z } from 'zod'

const uploadFileSchema = z.object({
  storageAccountId: z.string().min(1, 'Storage account ID is required'),
  path: z.string().min(1, 'File path is required').max(1000),
  name: z.string().min(1, 'File name is required').max(500),
  mimeType: z.string().min(1, 'MIME type is required').max(200),
  content: z.string().min(1, 'File content is required (base64 encoded)'),
})

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

    // Filter by storage account
    const accountId = searchParams.get('accountId')
    if (accountId) {
      where.storageAccountId = accountId
    }

    // Filter by MIME type
    const mimeType = searchParams.get('mimeType')
    if (mimeType) {
      where.mimeType = mimeType.startsWith('mime:')
        ? mimeType.slice(5)
        : { startsWith: mimeType }
    }

    // Search by file name
    const search = searchParams.get('search')
    if (search) {
      where.name = { contains: search }
    }

    // Filter by sync status
    const synced = searchParams.get('synced')
    if (synced === 'true') {
      where.isSynced = true
    } else if (synced === 'false') {
      where.isSynced = false
    }

    // Minimum file size filter
    const minSize = searchParams.get('minSize')
    if (minSize) {
      where.size = { ...(where.size as Record<string, unknown> || {}), gte: parseInt(minSize, 10) }
    }

    // Maximum file size filter
    const maxSize = searchParams.get('maxSize')
    if (maxSize) {
      where.size = { ...(where.size as Record<string, unknown> || {}), lte: parseInt(maxSize, 10) }
    }

    // Ordering
    const orderByParam = searchParams.get('orderBy') ?? 'updatedAt'
    const sortOrder = searchParams.get('sortOrder') ?? 'desc'
    const allowedOrderBy = ['name', 'size', 'mimeType', 'createdAt', 'updatedAt', 'lastModified']
    const orderBy = allowedOrderBy.includes(orderByParam) ? orderByParam : 'updatedAt'
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc'

    const [files, total] = await Promise.all([
      db.cloudFile.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
        include: {
          storageAccount: {
            select: {
              id: true,
              provider: true,
              name: true,
            },
          },
        },
      }),
      db.cloudFile.count({ where }),
    ])

    // Format files for response
    const formattedFiles = files.map((file) => ({
      id: file.id,
      storageAccountId: file.storageAccountId,
      providerFileId: file.providerFileId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      path: file.path,
      webUrl: file.webUrl,
      thumbnailUrl: file.thumbnailUrl,
      isSynced: file.isSynced,
      lastModified: file.lastModified?.toISOString() ?? null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      storageAccount: file.storageAccount,
    }))

    return NextResponse.json({
      success: true,
      data: {
        files: formattedFiles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/storage/files error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch files' },
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

    const parsed = uploadFileSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { storageAccountId, path, name, mimeType, content } = parsed.data

    // Verify the storage account belongs to the user and is enabled
    const account = await db.cloudStorageAccount.findFirst({
      where: { id: storageAccountId, userId, isEnabled: true },
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Storage account not found or is disabled' },
        { status: 404 }
      )
    }

    // Decode base64 content to Buffer
    const contentBuffer = Buffer.from(content, 'base64')

    // Upload the file via the storage manager
    const storageManager = StorageManager.getInstance()

    try {
      const provider = await storageManager.getAuthenticatedProvider(storageAccountId)
      const filePath = path.endsWith('/') ? `${path}${name}` : `${path}/${name}`
      const cloudFile = await provider.uploadFile(filePath, contentBuffer, mimeType)

      // Create a database record for the uploaded file
      const dbFile = await db.cloudFile.create({
        data: {
          storageAccountId,
          userId,
          providerFileId: cloudFile.providerFileId,
          name: cloudFile.name || name,
          mimeType: cloudFile.mimeType || mimeType,
          size: cloudFile.size || contentBuffer.length,
          path: cloudFile.path || filePath,
          webUrl: cloudFile.webUrl ?? null,
          thumbnailUrl: cloudFile.thumbnailUrl ?? null,
          lastModified: cloudFile.lastModified ? new Date(cloudFile.lastModified) : null,
          isSynced: true,
        },
        include: {
          storageAccount: {
            select: {
              id: true,
              provider: true,
              name: true,
            },
          },
        },
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            id: dbFile.id,
            storageAccountId: dbFile.storageAccountId,
            providerFileId: dbFile.providerFileId,
            name: dbFile.name,
            mimeType: dbFile.mimeType,
            size: dbFile.size,
            path: dbFile.path,
            webUrl: dbFile.webUrl,
            thumbnailUrl: dbFile.thumbnailUrl,
            isSynced: dbFile.isSynced,
            lastModified: dbFile.lastModified?.toISOString() ?? null,
            createdAt: dbFile.createdAt.toISOString(),
            updatedAt: dbFile.updatedAt.toISOString(),
            storageAccount: dbFile.storageAccount,
          },
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload file to storage provider'
      return NextResponse.json(
        { success: false, error: `Upload failed: ${message}` },
        { status: 422 }
      )
    }
  } catch (error) {
    console.error('POST /api/storage/files error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
