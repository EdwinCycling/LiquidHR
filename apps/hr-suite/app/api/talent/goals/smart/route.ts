import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { developmentGoalSmartRequestSchema, runDevelopmentGoalSmart } from '@/lib/talent/goal-ai'

export async function POST(request: Request): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? ''
  if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: 'AI_EVERYWHERE_INPUT_INVALID' }, { status: 400 })
  const parsed = developmentGoalSmartRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_EVERYWHERE_INPUT_INVALID' }, { status: 400 })
  try {
    const proposal = await runDevelopmentGoalSmart({ request: parsed.data, idempotencyKey })
    return NextResponse.json({ data: { proposedText: proposal.proposedText } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_EVERYWHERE_FAILED' }, { status: 500 })
  }
}
