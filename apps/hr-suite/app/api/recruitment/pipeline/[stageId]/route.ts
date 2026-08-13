import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { updateRecruitmentPipelineStage } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../../guided-route'

type RouteContext = { params: Promise<{ stageId: string }> }

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.name !== 'string' || typeof body.sortOrder !== 'number' || typeof body.isActive !== 'boolean' || typeof body.expectedVersion !== 'number') return invalidGuidedInput()
    const { stageId } = await params
    return NextResponse.json({ data: await updateRecruitmentPipelineStage({ id: stageId, name: body.name, sortOrder: body.sortOrder, isActive: body.isActive, expectedVersion: body.expectedVersion }, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
