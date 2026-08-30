import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { improveEmployeeNoteDescription, employeeNoteAiRequestSchema } from '@/lib/employees/employee-note-ai'
import { permissionErrorResponse } from '@/lib/auth/permissions'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? ''
  if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: 'AI_IMPROVE_INPUT_INVALID' }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'AI_IMPROVE_INPUT_INVALID' }, { status: 400 }) }
  const parsed = employeeNoteAiRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'AI_IMPROVE_INPUT_INVALID' }, { status: 400 })

  try {
    const proposal = await improveEmployeeNoteDescription({ employeeId: (await context.params).employeeId, request: parsed.data, idempotencyKey })
    return NextResponse.json({ data: { proposedText: proposal.proposedText } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_IMPROVE_FAILED' }, { status: 500 })
  }
}
