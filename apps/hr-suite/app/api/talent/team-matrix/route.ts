import { NextResponse } from 'next/server'
import { parseTalentTeamMatrixQuery } from '@/lib/talent/team-schemas'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const parsed = parseTalentTeamMatrixQuery(searchParams)
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const offset = Number(searchParams.get('offset') ?? 0)
    const limitValue = searchParams.get('limit')
    const limit = limitValue === null ? null : Number(limitValue)
    if (!Number.isSafeInteger(offset) || offset < 0 || (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100))) {
      return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    }
    const data = await listTalentTeamMatrix(parsed.data, { includeCapabilities: searchParams.get('includeCapabilities') !== 'false' })
    if (limit === null && offset === 0) return NextResponse.json({ data })
    return NextResponse.json({ data: { ...data, rows: data.rows.slice(offset, offset + (limit ?? 25)), totalCount: data.rows.length } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_TEAM_READ_FAILED')
  }
}
