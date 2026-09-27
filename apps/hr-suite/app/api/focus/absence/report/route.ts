import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { resolveFocusActAsSession } from '@/lib/focus/act-as-token'
import { AbsenceServiceError, reportFocusEmployeeAbsence } from '@/lib/absence/service'

const inputSchema = z.object({
  employeeId: z.string().uuid(),
  employmentId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
}).strict()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    const { employeeId, ...input } = parsed.data
    const requestContext = await getRequestAuthorizationContext()
    const session = await resolveFocusActAsSession(undefined, requestContext.context, requestContext.supabase)
    if (session) {
      if (session.subjectEmployeeId !== employeeId) return NextResponse.json({ error: 'FOCUS_ACT_AS_SCOPE_INVALID' }, { status: 403 })
    } else if (requestContext.context.employeeId !== employeeId) {
      return NextResponse.json({ error: 'ABSENCE_SELF_SERVICE_FORBIDDEN' }, { status: 403 })
    }
    const caseId = await reportFocusEmployeeAbsence(employeeId, input, requestContext.context)
    return NextResponse.json({ data: caseId }, { status: 201 })
  } catch (error) {
    if (error instanceof AbsenceServiceError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'ABSENCE_REPORT_FAILED' }, { status: 500 })
  }
}
