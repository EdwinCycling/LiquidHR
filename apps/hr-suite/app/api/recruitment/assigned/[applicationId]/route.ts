import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { getAssignedRecruitmentApplication } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse } from '../../guided-route'

type RouteContext = { params: Promise<{ applicationId: string }> }

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-participation:read')
    const { applicationId } = await params
    const data = await getAssignedRecruitmentApplication(applicationId)
    if (!data) return NextResponse.json({ code: 'RECRUITMENT_APPLICATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}
