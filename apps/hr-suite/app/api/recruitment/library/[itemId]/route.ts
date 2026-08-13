import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { setGuidedLibraryItemEnabled, updateGuidedLibraryItem } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../../guided-route'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-settings:manage')
    const { itemId } = await params
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null) return invalidGuidedInput()
    const client = await createClient()
    if ('enabled' in body && typeof body.enabled === 'boolean') {
      return NextResponse.json({ data: await setGuidedLibraryItemEnabled(itemId, body.enabled, client) })
    }
    if ('title' in body && 'content' in body && 'isActive' in body && 'expectedVersion' in body
      && typeof body.title === 'string' && typeof body.content === 'object' && body.content !== null
      && typeof body.isActive === 'boolean' && typeof body.expectedVersion === 'number') {
      return NextResponse.json({ data: await updateGuidedLibraryItem(itemId, { title: body.title, content: body.content as Record<string, unknown>, isActive: body.isActive, expectedVersion: body.expectedVersion }, client) })
    }
    return invalidGuidedInput()
  } catch (error) { return guidedErrorResponse(error) }
}
