import { NextResponse } from 'next/server'
import { teamCompassResponseSchema } from '@/lib/team-compass/schemas'
import { saveTeamCompassResponse, teamCompassErrorResponse } from '@/lib/team-compass/service'

export async function POST(request: Request, { params }: { params: Promise<{ participationId: string }> }) {
  try {
    const [{ participationId }, input] = await Promise.all([params, request.json().then((body) => teamCompassResponseSchema.safeParse(body))])
    if (!input.success) return NextResponse.json({ error: 'TEAM_COMPASS_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await saveTeamCompassResponse(participationId, input.data) })
  } catch (error) {
    return teamCompassErrorResponse(error)
  }
}
