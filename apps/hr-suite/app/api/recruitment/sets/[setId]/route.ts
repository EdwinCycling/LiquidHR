import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { updateGuidedSet } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../../guided-route'

type RouteContext = { params: Promise<{ setId: string }> }

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.name !== 'string' || typeof body.description !== 'string' || typeof body.isActive !== 'boolean' || typeof body.expectedVersion !== 'number' || !Array.isArray(body.itemIds)) return invalidGuidedInput()
    const { setId } = await params
    const itemIds = body.itemIds.filter((item: unknown): item is string => typeof item === 'string')
    return NextResponse.json({ data: await updateGuidedSet(setId, { name: body.name, description: body.description, isActive: body.isActive, itemIds, expectedVersion: body.expectedVersion }, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
