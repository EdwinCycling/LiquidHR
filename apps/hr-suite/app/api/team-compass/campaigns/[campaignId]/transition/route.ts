import { NextResponse } from 'next/server'
import { teamCompassTransitionSchema } from '@/lib/team-compass/schemas'
import { teamCompassErrorResponse, transitionTeamCompassCampaign } from '@/lib/team-compass/service'

export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const [{ campaignId }, input] = await Promise.all([params, request.json().then((body) => teamCompassTransitionSchema.safeParse(body))])
    if (!input.success) return NextResponse.json({ error: 'TEAM_COMPASS_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await transitionTeamCompassCampaign(campaignId, input.data) })
  } catch (error) {
    return teamCompassErrorResponse(error)
  }
}
