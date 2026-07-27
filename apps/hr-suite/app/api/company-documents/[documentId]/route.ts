import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDocumentServiceError, deleteCompanyDocument } from '@/lib/documents/company-document-service'

interface Context { params: Promise<{ documentId: string }> }

export async function DELETE(_request: Request, context: Context) {
  try { await deleteCompanyDocument((await context.params).documentId); return NextResponse.json({ data: { ok: true } }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error }
}
