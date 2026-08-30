import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { AiUsageInsightsServiceError, getAiUsageReport } from '@/lib/insights/ai-usage-report'
import { parseAiUsageQuery } from '@/lib/insights/ai-usage-query'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export async function GET(request: Request): Promise<NextResponse> {
  const query = parseAiUsageQuery(new URL(request.url).searchParams)
  if (!query) return NextResponse.json({ error: 'INSIGHTS_AI_USAGE_QUERY_INVALID' }, { headers: noStoreHeaders, status: 400 })

  try {
    const report = await getAiUsageReport(query)
    return NextResponse.json({ data: report }, { headers: noStoreHeaders })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof AiUsageInsightsServiceError) return NextResponse.json({ error: error.code }, { headers: noStoreHeaders, status: error.status })
    return NextResponse.json({ error: 'INSIGHTS_AI_USAGE_REPORT_FAILED' }, { headers: noStoreHeaders, status: 500 })
  }
}
