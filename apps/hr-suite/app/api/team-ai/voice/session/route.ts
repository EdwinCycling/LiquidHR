import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { createOpenAiRealtimeCall, createTeamRealtimeVoiceSessionConfiguration, isRealtimeVoiceEnabled, teamRealtimeVoiceSessionRequestSchema, resolveRealtimeVoiceModel } from '@/lib/ai/realtime-voice'
import { createTeamAiSession, failTeamAiSession, resolveTeamAiScope, TeamAiScopeError } from '@/lib/ai/team-scope'
import { isAiImproveAvailable } from '@/lib/ai/supabase-governance'
import { SupabaseAiSettingsPort } from '@/lib/ai/settings-service'
import { permissionErrorResponse, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = teamRealtimeVoiceSessionRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_TEAM_VOICE_INPUT_INVALID' }, { status: 400 })
  if (!isRealtimeVoiceEnabled() || !isAiImproveAvailable()) return NextResponse.json({ error: 'AI_TEAM_VOICE_DISABLED' }, { status: 503 })

  let sessionId: string | null = null
  try {
    const authContext = await requirePermission('start-page:read')
    await requirePermission('ai:use')
    const scope = await resolveTeamAiScope(authContext, parsed.data.departmentId)
    const settings = await new SupabaseAiSettingsPort().assertVoiceAllowed({
      scope: { tenantId: authContext.tenantId, hrGroupId: requireHrGroupId(authContext), administrationId: authContext.administrationId },
      authContext,
      contextType: 'TEAM',
    })
    sessionId = await createTeamAiSession({ auth: authContext, scope, model: resolveRealtimeVoiceModel() })
    try {
      const sdpAnswer = await createOpenAiRealtimeCall({
        sdpOffer: parsed.data.sdpOffer,
        session: createTeamRealtimeVoiceSessionConfiguration(parsed.data.locale, settings),
      })
      return NextResponse.json({ data: { sessionId, sdpAnswer, scopeType: scope.scopeType, contextName: scope.contextName } })
    } catch (error) {
      await failTeamAiSession({ auth: authContext, sessionId }).catch(() => undefined)
      throw error
    }
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TeamAiScopeError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_TEAM_VOICE_SESSION_FAILED' }, { status: 502 })
  }
}
