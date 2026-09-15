import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  createOpenAiRealtimeCall,
  createRealtimeVoiceSession,
  createRealtimeVoiceSessionConfiguration,
  isRealtimeVoiceEnabled,
  markRealtimeVoiceSessionFailed,
  realtimeVoiceSessionRequestSchema,
  requireEmployeeVoiceContext,
  resolveRealtimeVoiceModel,
} from '@/lib/ai/realtime-voice'
import { getAiGroupSettingsForContext } from '@/lib/ai/settings-service'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { employeeId } = await context.params
  const parsed = realtimeVoiceSessionRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_VOICE_INPUT_INVALID' }, { status: 400 })
  if (!isRealtimeVoiceEnabled()) return NextResponse.json({ error: 'AI_VOICE_DISABLED' }, { status: 403 })

  let sessionId: string | null = null
  try {
    const authContext = await requireEmployeeVoiceContext(employeeId)
    const model = resolveRealtimeVoiceModel()
    const settings = await getAiGroupSettingsForContext(authContext)
    sessionId = await createRealtimeVoiceSession({ context: authContext, employeeId, model })
    try {
      const sdpAnswer = await createOpenAiRealtimeCall({
        sdpOffer: parsed.data.sdpOffer,
        session: createRealtimeVoiceSessionConfiguration(parsed.data.locale, settings),
      })
      return NextResponse.json({ data: { sessionId, sdpAnswer } })
    } catch (error) {
      await markRealtimeVoiceSessionFailed(sessionId, authContext).catch(() => undefined)
      throw error
    }
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AiExecutionError) {
      const status = error.code === 'FEATURE_UNAVAILABLE' ? 503 : error.status
      return NextResponse.json({ error: error.code }, { status })
    }
    return NextResponse.json({ error: 'AI_VOICE_SESSION_FAILED' }, { status: 502 })
  }
}
