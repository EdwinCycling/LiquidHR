import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { listRecruitmentParticipantOptions } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse } from '../guided-route'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const { context, supabase } = await getRequestAuthorizationContext()
    await requirePermission('recruitment-candidate:write')
    return NextResponse.json({ data: await listRecruitmentParticipantOptions(context, supabase) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}
