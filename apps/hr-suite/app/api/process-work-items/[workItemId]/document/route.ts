import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createDocumentAcknowledgementDownload, documentAcknowledgementErrorResponse } from '@/lib/process-automation/document-acknowledgement-service'

interface Params { readonly params: Promise<{ workItemId: string }> }

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { workItemId } = await params
    return NextResponse.redirect(await createDocumentAcknowledgementDownload(workItemId))
  } catch (error) {
    return permissionErrorResponse(error)
      ?? documentAcknowledgementErrorResponse(error)
      ?? NextResponse.json({ code: 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_DOWNLOAD_FAILED' }, { status: 500 })
  }
}
