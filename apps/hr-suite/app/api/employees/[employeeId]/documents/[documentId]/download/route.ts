import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createDocumentDownload, DocumentServiceError } from '@/lib/documents/document-service'
import { sanitizeDocumentFilename } from '@/lib/documents/file-rules'

interface Context { params: Promise<{ employeeId: string; documentId: string }> }

function contentDisposition(filename: string): string {
  const fallback = sanitizeDocumentFilename(filename).replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(_request: Request, context: Context) {
  try {
    const { employeeId, documentId } = await context.params
    const file = await createDocumentDownload(employeeId, documentId)
    return new Response(file.body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition(file.originalFilename),
        'Content-Length': String(file.fileSize),
        'Content-Type': file.contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
