import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { selectActiveContext } from '@/lib/context/administration-context'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE, loadAccessibleContextOptions } from '@/lib/context/server-context'

const selectionSchema = z.object({
  tenantId: z.string().uuid(),
  hrGroupId: z.string().uuid(),
}).strict()

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const selection = selectionSchema.parse(body)
    const { tenants } = await loadAccessibleContextOptions()
    const context = selectActiveContext({ tenants, requestedTenantId: selection.tenantId, requestedHrGroupId: selection.hrGroupId })
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    }
    cookieStore.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
    cookieStore.set(ACTIVE_HR_GROUP_COOKIE, context.activeHrGroup.id, cookieOptions)
    cookieStore.delete(ACTIVE_ADMINISTRATION_COOKIE)
    return NextResponse.json({ data: { tenantId: context.tenant.id, hrGroupId: context.activeHrGroup.id } })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'CONTEXT_SELECTION_INVALID' }, { status: 400 })
    throw error
  }
}
