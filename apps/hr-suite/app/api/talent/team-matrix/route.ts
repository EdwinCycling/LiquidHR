import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export async function GET() {
  try {
    return NextResponse.json({ data: await listTalentTeamMatrix() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_TEAM_READ_FAILED')
  }
}
