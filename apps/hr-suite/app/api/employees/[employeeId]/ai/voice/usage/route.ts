import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  finishRealtimeVoiceSession,
  realtimeVoiceUsageRequestSchema,
  requireEmployeeVoiceContext,
} from '@/lib/ai/realtime-voice'

interface RouteContext { params: Promise<{ employeeId: string }> }

function usageFailureMetadata(error: unknown): { category: string; code?: string } {
  if (!(error instanceof AiExecutionError)) return { category: 'unexpected' }
  const categoryByCode: Partial<Record<AiExecutionError['code'], string>> = {
    CREDITS_UNAVAILABLE: 'credits-unavailable',
    CREDITS_EXHAUSTED: 'credits-exhausted',
    QUOTA_REACHED: 'quota-reached',
    INTERNAL_CONFIGURATION_ERROR: 'configuration',
    FEATURE_UNAVAILABLE: 'feature-unavailable',
  }
  return { category: categoryByCode[error.code] ?? 'ai-execution-failure', code: error.code }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { employeeId } = await context.params
  const parsed = realtimeVoiceUsageRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_VOICE_USAGE_INPUT_INVALID' }, { status: 400 })
  try {
    const authContext = await requireEmployeeVoiceContext(employeeId)
    await finishRealtimeVoiceSession({ ...parsed.data, context: authContext, terminationReason: parsed.data.terminationReason ?? 'EXPLICIT' })
    return NextResponse.json({ data: { recorded: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    console.error('[AI_VOICE_USAGE]', usageFailureMetadata(error))
    return NextResponse.json({ error: 'AI_VOICE_USAGE_FAILED' }, { status: 422 })
  }
}
