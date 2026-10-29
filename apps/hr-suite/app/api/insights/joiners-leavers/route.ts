import { NextResponse } from 'next/server'

import { permissionErrorResponse } from '@/lib/auth/permissions'
import { joinersLeaversCsv } from '@/lib/insights/joiners-leavers-csv'
import { parseJoinersLeaversQuery } from '@/lib/insights/joiners-leavers-query'
import { getJoinersLeaversReport, JoinersLeaversServiceError } from '@/lib/insights/joiners-leavers-service'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = parseJoinersLeaversQuery(params)
  if (!query) return NextResponse.json({ error: 'INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    const report = await getJoinersLeaversReport(query)
    if (params.get('format') === 'csv') {
      const locale = params.get('locale') === 'en' ? 'en' : 'nl'
      return new NextResponse(joinersLeaversCsv(report, locale), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="joiners-leavers-${report.period.toMonth}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof JoinersLeaversServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'INSIGHTS_JOINERS_LEAVERS_FAILED' }, { status: 500 })
  }
}
