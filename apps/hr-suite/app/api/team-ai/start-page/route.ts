import { NextResponse } from 'next/server'
import { getTeamAiStartPageData } from '@/lib/ai/team-scope'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'

const noStoreHeaders = { 'Cache-Control': 'private, no-store' }

export const dynamic = 'force-dynamic'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', noStoreHeaders['Cache-Control'])
  return response
}

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requirePermission('start-page:read')
    await requirePermission('ai:use')
    const data = await getTeamAiStartPageData(auth)
    return NextResponse.json({ data }, { headers: noStoreHeaders })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return noStore(permissionResponse)
    return NextResponse.json({ error: 'TEAM_AI_START_PAGE_FAILED' }, { headers: noStoreHeaders, status: 500 })
  }
}
