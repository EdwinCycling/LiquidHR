import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestAuthorizationContext, getSelfPermissions } from '@/lib/auth/permissions'
import { resolveFocusActAsSession } from '@/lib/focus/act-as-token'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { startFocusLeaveRequestWorkflow, startLeaveRequestWorkflow } from '@/lib/leave/workflow-service'
import { leaveRequestConfirmSchema } from '@/lib/leave/schemas'

const requestEnvelopeSchema = z.object({ actAs: z.string().trim().min(1).max(4096).nullable().optional() }).passthrough()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const envelope = requestEnvelopeSchema.safeParse(await request.json())
    if (!envelope.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    const { actAs, ...input } = envelope.data
    const parsed = leaveRequestConfirmSchema.safeParse(input)
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })

    if (!actAs) {
      return NextResponse.json({ data: await startLeaveRequestWorkflow(parsed.data) }, { status: 201 })
    }

    const requestContext = await getRequestAuthorizationContext()
    const session = await resolveFocusActAsSession(actAs, requestContext.context, requestContext.supabase)
    if (!session || session.subjectEmployeeId !== parsed.data.employeeId) return NextResponse.json({ error: 'FOCUS_ACT_AS_SCOPE_INVALID' }, { status: 403 })
    const selfPermissions = await getSelfPermissions(requestContext.supabase, requestContext.context.tenantId)
    if (!selfPermissions.includes('self:leave:request')) return NextResponse.json({ error: 'LEAVE_SELF_SERVICE_FORBIDDEN' }, { status: 403 })
    return NextResponse.json({ data: await startFocusLeaveRequestWorkflow(parsed.data, requestContext) }, { status: 201 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
