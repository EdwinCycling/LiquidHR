import { NextResponse } from 'next/server'
import { parseTalentTeamMatrixQuery } from '@/lib/talent/team-schemas'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export async function GET(request: Request) {
  try {
    const parsed = parseTalentTeamMatrixQuery(new URL(request.url).searchParams)
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentTeamMatrix(parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_TEAM_READ_FAILED')
  }
}
