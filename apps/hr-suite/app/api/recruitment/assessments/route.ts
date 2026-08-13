import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { upsertAssessmentDraft } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-participation:write')
    const body = await request.json().catch(() => null)
    if (body === null) return invalidGuidedInput()
    return NextResponse.json({ data: await upsertAssessmentDraft(body, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
