import { NextResponse } from 'next/server'

import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getHeadcountFteReport, HeadcountFteServiceError } from '@/lib/insights/headcount-fte-service'
import { headcountFteCsv } from '@/lib/insights/headcount-fte-csv'
import { parseHeadcountFteQuery } from '@/lib/insights/headcount-fte-query'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = parseHeadcountFteQuery(params)
  if (!query) return NextResponse.json({ error: 'INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    const report = await getHeadcountFteReport(query)
    if (params.get('format') === 'csv') {
      const locale = params.get('locale') === 'en' ? 'en' : 'nl'
      return new NextResponse(headcountFteCsv(report, locale), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="headcount-fte-${report.period.toMonth}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof HeadcountFteServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'INSIGHTS_HEADCOUNT_FAILED' }, { status: 500 })
  }
}
