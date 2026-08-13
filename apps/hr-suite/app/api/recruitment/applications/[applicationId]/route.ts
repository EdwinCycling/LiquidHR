import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-candidate:read', 'recruitment-participation:read'])
    const { applicationId } = await params
    const data = await getRecruitmentApplication(requestContext.context, applicationId, requestContext.supabase)
    if (!data) return NextResponse.json({ code: 'RECRUITMENT_APPLICATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
