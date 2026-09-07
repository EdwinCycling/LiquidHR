import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { EMPLOYEE_SUMMARY_FEATURE } from '@/lib/ai/feature-registry'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employeeAiRequestSchema, runEmployeeAi } from '@/lib/employees/employee-ai'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? ''
  if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: 'AI_EVERYWHERE_INPUT_INVALID' }, { status: 400 })
  const body: unknown = await request.json().catch(() => null)
  const parsed = employeeAiRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'AI_EVERYWHERE_INPUT_INVALID' }, { status: 400 })
  try {
    const proposal = await runEmployeeAi({ employeeId: (await context.params).employeeId, feature: EMPLOYEE_SUMMARY_FEATURE, request: parsed.data, idempotencyKey })
    return NextResponse.json({ data: { proposedText: proposal.proposedText } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_EVERYWHERE_FAILED' }, { status: 500 })
  }
}
