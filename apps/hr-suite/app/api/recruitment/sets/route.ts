import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createGuidedSet, listGuidedSets } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const { context, supabase } = await getRequestAuthorizationContext()
    await requirePermission('recruitment-settings:manage')
    return NextResponse.json({ data: await listGuidedSets(context, supabase) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.stableCode !== 'string' || typeof body.name !== 'string' || typeof body.description !== 'string' || !Array.isArray(body.itemIds)) return invalidGuidedInput()
    const itemIds = body.itemIds.filter((item: unknown): item is string => typeof item === 'string')
    return NextResponse.json({ data: await createGuidedSet(context, { stableCode: body.stableCode, name: body.name, description: body.description, itemIds }, await createClient()) }, { status: 201 })
  } catch (error) { return guidedErrorResponse(error) }
}
