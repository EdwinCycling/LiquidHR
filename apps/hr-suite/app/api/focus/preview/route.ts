import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthorizationError, getRequestAuthorizationContext, permissionErrorResponse } from '@/lib/auth/permissions'
import { setFocusPreviewCookie } from '@/lib/focus/preview-token'
import { databaseUuid } from '@/lib/validation/database-uuid'

const requestSchema = z.object({ employeeId: databaseUuid }).strict()

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PREVIEW_TARGET' }, { status: 400 })

  try {
    const requestContext = await getRequestAuthorizationContext()
    if (!requestContext.context.permissions.includes('user:invite')) throw new AuthorizationError('Je hebt geen recht om een Focus-preview te openen.')
    const { data: employee, error } = await requestContext.supabase
      .from('employees')
      .select('id')
      .eq('id', parsed.data.employeeId)
      .eq('tenant_id', requestContext.context.tenantId)
      .eq('hr_group_id', requestContext.context.hrGroupId ?? '')
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (!employee) throw new AuthorizationError('Deze medewerker valt niet binnen je actieve HR-groep.')

    await setFocusPreviewCookie({
      actorUserId: requestContext.context.userId,
      tenantId: requestContext.context.tenantId,
      hrGroupId: requestContext.context.hrGroupId ?? '',
      employeeId: employee.id,
    })
    return NextResponse.json({ data: { employeeId: employee.id } }, { status: 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: 'PREVIEW_START_FAILED' }, { status: 500 })
  }
}
