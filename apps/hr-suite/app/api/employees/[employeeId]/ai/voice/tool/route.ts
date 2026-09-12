import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { runEmployeeAi } from '@/lib/employees/employee-ai'
import {
  parseRealtimeVoiceToolArguments,
  realtimeVoiceToolRequestSchema,
  requireEmployeeVoiceContext,
} from '@/lib/ai/realtime-voice'
import { runDevelopmentGoalSmart } from '@/lib/talent/goal-ai'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { employeeId } = await context.params
  const parsed = realtimeVoiceToolRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_VOICE_TOOL_INPUT_INVALID' }, { status: 400 })
  try {
    await requireEmployeeVoiceContext(employeeId)
    const args = parseRealtimeVoiceToolArguments(parsed.data.name, parsed.data.arguments)
    const idempotencyKey = randomUUID()
    if (parsed.data.name === 'employee_summary') {
      const proposal = await runEmployeeAi({ employeeId, feature: 'EMPLOYEE_SUMMARY', request: { locale: parsed.data.locale }, idempotencyKey })
      return NextResponse.json({ data: { proposedText: proposal.proposedText } })
    }
    if (parsed.data.name === 'conversation_preparation') {
      const proposal = await runEmployeeAi({ employeeId, feature: 'CONVERSATION_PREPARATION', request: { locale: parsed.data.locale }, idempotencyKey })
      return NextResponse.json({ data: { proposedText: proposal.proposedText } })
    }
    if (!args.sourceText) return NextResponse.json({ error: 'AI_VOICE_TOOL_INPUT_INVALID' }, { status: 400 })
    const proposal = await runDevelopmentGoalSmart({
      request: { employeeId, sourceText: args.sourceText, locale: parsed.data.locale },
      idempotencyKey,
    })
    return NextResponse.json({ data: { proposedText: proposal.proposedText } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_VOICE_TOOL_FAILED' }, { status: 422 })
  }
}
