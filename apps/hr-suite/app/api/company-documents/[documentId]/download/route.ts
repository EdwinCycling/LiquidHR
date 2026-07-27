import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { CompanyDocumentServiceError, createCompanyDocumentDownload } from '@/lib/documents/company-document-service'

interface Context { params: Promise<{ documentId: string }> }

export async function GET(_request: Request, context: Context) {
  try { return NextResponse.redirect(await createCompanyDocumentDownload((await context.params).documentId)) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof CompanyDocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error }
}
