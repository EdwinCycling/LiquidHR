import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDocumentServiceError, listCompanyDocuments, uploadCompanyDocument } from '@/lib/documents/company-document-service'
import { companyDocumentMetadataSchema } from '@/lib/documents/company-schemas'

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof CompanyDocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function GET() {
  try { return NextResponse.json({ data: await listCompanyDocuments() }) } catch (error) { const response = failure(error); if (response) return response; throw error }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    const raw = form.get('metadata')
    if (!(file instanceof File) || typeof raw !== 'string') return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 })
    const parsed = companyDocumentMetadataSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await uploadCompanyDocument(file, parsed.data) } }, { status: 201 })
  } catch (error) { const response = failure(error); if (response) return response; return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 }) }
}
