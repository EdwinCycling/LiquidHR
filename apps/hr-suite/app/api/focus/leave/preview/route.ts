import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, getSelfPermissions } from '@/lib/auth/permissions'
import { resolveFocusActAsSession } from '@/lib/focus/act-as-token'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { getLeaveRequestPreview } from '@/lib/leave/request-service'
import { leaveRequestPreviewQuerySchema } from '@/lib/leave/schemas'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const parsed = leaveRequestPreviewQuerySchema.safeParse({
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      employmentId: url.searchParams.get('employmentId') ?? undefined,
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      mode: url.searchParams.get('mode') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })

    const requestContext = await getRequestAuthorizationContext()
    const session = await resolveFocusActAsSession(undefined, requestContext.context, requestContext.supabase)
    if (!session) return NextResponse.json({ data: await getLeaveRequestPreview(parsed.data, 'self:leave:request') })
    if (session.subjectEmployeeId !== parsed.data.employeeId) return NextResponse.json({ error: 'FOCUS_ACT_AS_SCOPE_INVALID' }, { status: 403 })
    const selfPermissions = await getSelfPermissions(requestContext.supabase, requestContext.context.tenantId)
    if (!selfPermissions.includes('self:leave:request')) return NextResponse.json({ error: 'LEAVE_SELF_SERVICE_FORBIDDEN' }, { status: 403 })
    return NextResponse.json({ data: await getLeaveRequestPreview(parsed.data, 'leave:request', requestContext) })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
