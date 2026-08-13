import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'

export async function GET(_request: Request, { params }: { params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read'])
    const { vacancyId } = await params
    const vacancy = await getRecruitmentVacancy(requestContext.context, vacancyId, requestContext.supabase)
    if (!vacancy) return NextResponse.json({ code: 'RECRUITMENT_VACANCY_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data: { vacancyId: vacancy.id, fixedFields: { firstName: 'REQUIRED', lastName: 'REQUIRED', email: 'REQUIRED' }, configurableFields: ['PHONE', 'CV', 'MOTIVATION'], questions: [] } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? (() => { throw error })()
  }
}
