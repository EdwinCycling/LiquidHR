import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { DocumentServiceError, listEmployeeDocuments, uploadEmployeeDocument } from '@/lib/documents/document-service'
import { documentMetadataSchema } from '@/lib/documents/schemas'
interface Context { params: Promise<{ employeeId: string }> }
function failure(error: unknown) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); return null }
export async function GET(_request: Request, context: Context) { try { const { employeeId } = await context.params; return NextResponse.json({ data: await listEmployeeDocuments(employeeId) }) } catch (error) { const response = failure(error); if (response) return response; throw error } }
export async function POST(request: Request, context: Context) {
  try {
    const { employeeId } = await context.params
    const form = await request.formData()
    const file = form.get('file')
    const raw = form.get('metadata')
    if (!(file instanceof File) || typeof raw !== 'string') return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 })

    const metadata: unknown = JSON.parse(raw)
    const parsed = documentMetadataSchema.safeParse(metadata)
    if (!parsed.success) {
      const issueCode = parsed.error.issues[0]?.message
      const code = issueCode && /^[A-Z_]+$/.test(issueCode) ? issueCode : 'DOCUMENT_INPUT_INVALID'
      return NextResponse.json({ code }, { status: 400 })
    }

    return NextResponse.json({ data: { id: await uploadEmployeeDocument(employeeId, file, parsed.data) } }, { status: 201 })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 })
  }
}
