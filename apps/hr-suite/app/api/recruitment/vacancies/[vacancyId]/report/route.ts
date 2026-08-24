import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancyReport, parseVacancyReportQuery } from '@/lib/recruitment/vacancy-report-service'
import { guidedErrorResponse } from '../../../guided-route'

export async function GET(request: Request, { params }: { readonly params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requirePermission('recruitment-candidate:read')
    const { vacancyId } = await params
    const query = parseVacancyReportQuery(Object.fromEntries(new URL(request.url).searchParams.entries()))
    const data = await getRecruitmentVacancyReport(requestContext.context, vacancyId, query, requestContext.supabase)
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? guidedErrorResponse(error)
  }
}
