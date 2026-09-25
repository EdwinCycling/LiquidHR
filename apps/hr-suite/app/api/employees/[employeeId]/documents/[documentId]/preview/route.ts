import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createDocumentPreview, DocumentServiceError } from '@/lib/documents/document-service'

interface Context { params: Promise<{ employeeId: string; documentId: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const { employeeId, documentId } = await context.params
    const preview = await createDocumentPreview(employeeId, documentId)
    return new Response(preview.body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Length': String(preview.fileSize),
        'Content-Type': preview.contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
    return NextResponse.json({ code: 'DOCUMENT_PREVIEW_FAILED' }, { status: 500 })
  }
}
