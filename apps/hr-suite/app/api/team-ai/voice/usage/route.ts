import { NextResponse } from 'next/server'
import { TeamAiScopeError, finishTeamAiSession } from '@/lib/ai/team-scope'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { realtimeVoiceUsageRequestSchema } from '@/lib/ai/realtime-voice'

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = realtimeVoiceUsageRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_TEAM_VOICE_USAGE_INPUT_INVALID' }, { status: 400 })
  try {
    const authContext = await requirePermission('start-page:read')
    await requirePermission('ai:use')
    await finishTeamAiSession({ auth: authContext, ...parsed.data, terminationReason: parsed.data.terminationReason ?? 'EXPLICIT' })
    return NextResponse.json({ data: { recorded: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TeamAiScopeError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_TEAM_VOICE_USAGE_FAILED' }, { status: 422 })
  }
}
