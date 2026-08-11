import { NextResponse } from 'next/server'
import { teamCompassCampaignSchema } from '@/lib/team-compass/schemas'
import { saveTeamCompassCampaign, teamCompassErrorResponse } from '@/lib/team-compass/service'

export async function POST(request: Request) {
  try {
    const input = teamCompassCampaignSchema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ error: 'TEAM_COMPASS_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await saveTeamCompassCampaign(input.data) }, { status: input.data.campaignId ? 200 : 201 })
  } catch (error) {
    return teamCompassErrorResponse(error)
  }
}
