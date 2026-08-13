import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createGuidedLibraryItem, listGuidedLibrary } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const { context, supabase } = await getRequestAuthorizationContext()
    await requirePermission('recruitment-settings:manage')
    return NextResponse.json({ data: await listGuidedLibrary(context, supabase) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (body === null) return invalidGuidedInput()
    return NextResponse.json({ data: await createGuidedLibraryItem(context, body, await createClient()) }, { status: 201 })
  } catch (error) { return guidedErrorResponse(error) }
}
