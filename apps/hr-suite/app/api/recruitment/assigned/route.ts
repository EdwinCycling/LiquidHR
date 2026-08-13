import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { listAssignedRecruitmentApplications } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse } from '../guided-route'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-participation:read')
    return NextResponse.json({ data: await listAssignedRecruitmentApplications() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}
