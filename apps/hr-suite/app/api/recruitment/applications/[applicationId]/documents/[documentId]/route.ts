import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string; documentId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requireAnyPermission(['recruitment-candidate:read', 'recruitment-participation:read'])
    const { applicationId, documentId } = await params
    const supabase = await createClient()
    const claim = await supabase.rpc('recruitment_document_download_claim', { requested_document_id: documentId })
    if (claim.error) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
    if (!claim.data?.length) return NextResponse.json({ code: 'RECRUITMENT_DOCUMENT_NOT_FOUND' }, { status: 404 })
    const admin = createAdminClient()
    const document = await admin.from('recruitment_documents').select('storage_key,application_id').eq('id', documentId).eq('application_id', applicationId).maybeSingle()
    if (document.error || !document.data) return NextResponse.json({ code: 'RECRUITMENT_DOCUMENT_NOT_FOUND' }, { status: 404 })
    const signed = await admin.storage.from('recruitment-documents').createSignedUrl(document.data.storage_key, 60)
    if (signed.error || !signed.data?.signedUrl) throw new RecruitmentError('RECRUITMENT_DOCUMENT_DOWNLOAD_FAILED', 500)
    return NextResponse.json({ data: { url: signed.data.signedUrl, expiresInSeconds: 60 } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
