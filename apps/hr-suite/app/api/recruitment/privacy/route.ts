import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { anonymizeRecruitmentApplication } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.applicationId !== 'string') return invalidGuidedInput()
    return NextResponse.json({ data: await anonymizeRecruitmentApplication(body.applicationId, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
