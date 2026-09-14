import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { leaveInsightsCsv } from '@/lib/insights/leave-insights-csv'
import { parseLeaveInsightsQuery } from '@/lib/insights/leave-insights-query'
import { getLeaveInsightsReport, LeaveInsightsServiceError } from '@/lib/insights/leave-insights-service'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = parseLeaveInsightsQuery(params)
  if (!query) return NextResponse.json({ error: 'LEAVE_INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    const report = await getLeaveInsightsReport(query)
    if (params.get('format') === 'csv') {
      return new NextResponse(leaveInsightsCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="leave-insights-${query.view}-${query.year}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof LeaveInsightsServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'LEAVE_INSIGHTS_REPORT_FAILED' }, { status: 500 })
  }
}
