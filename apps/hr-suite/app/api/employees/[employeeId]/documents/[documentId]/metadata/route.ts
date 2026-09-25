import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { DocumentServiceError, updateEmployeeDocumentMetadata } from '@/lib/documents/document-service'
import { documentMetadataSchema } from '@/lib/documents/schemas'

interface Context { params: Promise<{ employeeId: string; documentId: string }> }

function failure(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function PATCH(request: Request, route: Context): Promise<NextResponse> {
  try {
    const { employeeId, documentId } = await route.params
    const parsed = documentMetadataSchema.safeParse(await request.json())
    if (!parsed.success) {
      const issueCode = parsed.error.issues[0]?.message
      const code = issueCode && /^[A-Z_]+$/.test(issueCode) ? issueCode : 'DOCUMENT_INPUT_INVALID'
      return NextResponse.json({ code }, { status: 400 })
    }
    await updateEmployeeDocumentMetadata(employeeId, documentId, parsed.data)
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 })
  }
}
