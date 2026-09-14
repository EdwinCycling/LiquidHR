import { NextResponse } from 'next/server'
import { AiExecutionError } from '@/lib/ai/contracts'
import { teamRealtimeVoiceToolRequestSchema } from '@/lib/ai/realtime-voice'
import { executeTeamAiTool, TeamAiToolError } from '@/lib/ai/team-ai'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { TeamAiScopeError } from '@/lib/ai/team-scope'

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = teamRealtimeVoiceToolRequestSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_TEAM_VOICE_TOOL_INPUT_INVALID' }, { status: 400 })
  try {
    const authContext = await requirePermission('start-page:read')
    await requirePermission('ai:use')
    const result = await executeTeamAiTool({ auth: authContext, ...parsed.data })
    return NextResponse.json({ data: result })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TeamAiToolError || error instanceof TeamAiScopeError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'AI_TEAM_VOICE_TOOL_FAILED' }, { status: 422 })
  }
}
