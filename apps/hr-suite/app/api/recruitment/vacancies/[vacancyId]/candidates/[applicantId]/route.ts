import { NextResponse } from 'next/server'

import { getRequestAuthorizationContext, permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { applicantDetailRouteParamsSchema, getRecruitmentApplicantDetail } from '@/lib/recruitment/applicant-detail-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

type RouteContext = { params: Promise<{ vacancyId: string; applicantId: string }> }

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-candidate:read', 'recruitment-participation:read'])
    const parsed = applicantDetailRouteParamsSchema.safeParse(await params)
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_APPLICANT_DETAIL_INPUT_INVALID' }, { status: 400 })
    const data = await getRecruitmentApplicantDetail(requestContext.context, parsed.data, requestContext.supabase)
    if (!data) return NextResponse.json({ code: 'RECRUITMENT_APPLICATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
