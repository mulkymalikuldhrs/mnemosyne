import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { id } = await params

    const file = await db.cloudFile.findFirst({
      where: { id, userId },
      include: {
        storageAccount: {
          select: {
            id: true,
            provider: true,
            name: true,
            isEnabled: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      )
    }

    // Check if the client wants to download the file content
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    let downloadContent: string | null = null
    let contentMimeType: string | null = null

    if (download && file.storageAccount.isEnabled) {
      try {
        const storageManager = StorageManager.getInstance()
        const provider = await storageManager.getAuthenticatedProvider(
          file.storageAccountId
        )
        const contentBuffer = await provider.downloadFile(file.providerFileId)

        // Return the content as base64
        downloadContent = contentBuffer.toString('base64')
        contentMimeType = file.mimeType
      } catch (error: unknown) {
        // File details are still returned, but download failed
        console.error('Download failed for file', id, error)
      }
    }

    const fileDetails = {
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
      ...(downloadContent !== null && {
        content: downloadContent,
        contentEncoding: 'base64',
        contentMimeType,
      }),
    }

    return NextResponse.json({
      success: true,
      data: fileDetails,
    })
  } catch (error) {
    console.error('GET /api/storage/files/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch file details' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { id } = await params

    // Verify ownership
    const file = await db.cloudFile.findFirst({
      where: { id, userId },
      include: {
        storageAccount: {
          select: {
            id: true,
            provider: true,
            isEnabled: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      )
    }

    // Try to delete from the remote storage provider
    let remoteDeleted = false
    if (file.storageAccount.isEnabled) {
      try {
        const storageManager = StorageManager.getInstance()
        const provider = await storageManager.getAuthenticatedProvider(
          file.storageAccountId
        )
        await provider.deleteFile(file.providerFileId)
        remoteDeleted = true
      } catch (error: unknown) {
        // Remote deletion failed, but we still remove the local record
        console.error('Remote file deletion failed for', id, error)
      }
    }

    // Delete the database record
    await db.cloudFile.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: {
        id,
        deleted: true,
        remoteDeleted,
      },
    })
  } catch (error) {
    console.error('DELETE /api/storage/files/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
