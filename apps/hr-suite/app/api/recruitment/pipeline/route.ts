import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createRecruitmentPipelineStage } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.code !== 'string' || typeof body.name !== 'string' || typeof body.sortOrder !== 'number') return invalidGuidedInput()
    return NextResponse.json({ data: await createRecruitmentPipelineStage(context, { code: body.code, name: body.name, sortOrder: body.sortOrder }, await createClient()) }, { status: 201 })
  } catch (error) { return guidedErrorResponse(error) }
}
