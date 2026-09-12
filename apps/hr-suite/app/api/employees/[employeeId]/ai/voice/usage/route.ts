import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  finishRealtimeVoiceSession,
  realtimeVoiceUsageRequestSchema,
  requireEmployeeVoiceContext,
} from '@/lib/ai/realtime-voice'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { employeeId } = await context.params
  const parsed = realtimeVoiceUsageRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_VOICE_USAGE_INPUT_INVALID' }, { status: 400 })
  try {
    const authContext = await requireEmployeeVoiceContext(employeeId)
    await finishRealtimeVoiceSession({ ...parsed.data, context: authContext })
    return NextResponse.json({ data: { recorded: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'AI_VOICE_USAGE_FAILED' }, { status: 422 })
  }
}
