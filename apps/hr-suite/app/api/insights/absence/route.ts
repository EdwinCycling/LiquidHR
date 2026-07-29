import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { absenceInsightExcel } from '@/lib/insights/absence-excel'
import { getAbsenceInsightReport, AbsenceInsightsServiceError } from '@/lib/insights/absence-report'
import { parseAbsenceInsightQuery } from '@/lib/insights/absence-query'
import { bradfordInsightExcel } from '@/lib/insights/bradford-excel'
import { getBradfordInsightReport } from '@/lib/insights/bradford-report'
import { parseBradfordInsightQuery } from '@/lib/insights/bradford-query'
import { frequentAbsenceExcel } from '@/lib/insights/frequent-absence-excel'
import { getFrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'
import { parseFrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const frequentQuery = parseFrequentAbsenceQuery(params)
  const bradfordQuery = parseBradfordInsightQuery(params)
  const query = parseAbsenceInsightQuery(params)
  if (!query && !bradfordQuery && !frequentQuery) return NextResponse.json({ error: 'INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    if (frequentQuery) {
      const report = await getFrequentAbsenceReport(frequentQuery)
      if (params.get('format') === 'excel') {
        return new NextResponse(frequentAbsenceExcel(report), {
          headers: {
            'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
            'Content-Disposition': `attachment; filename="frequent-verzuim-${frequentQuery.startDate}-${frequentQuery.endDate}.xls"`,
            'Cache-Control': 'no-store',
          },
        })
      }
      return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (bradfordQuery) {
      const report = await getBradfordInsightReport(bradfordQuery)
      if (params.get('format') === 'excel') {
        return new NextResponse(bradfordInsightExcel(report), {
          headers: {
            'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
            'Content-Disposition': `attachment; filename="bradford-factor-${bradfordQuery.startDate}-${bradfordQuery.endDate}.xls"`,
            'Cache-Control': 'no-store',
          },
        })
      }
      return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!query) return NextResponse.json({ error: 'INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
    const report = await getAbsenceInsightReport(query)
    if (params.get('format') === 'excel') {
      return new NextResponse(absenceInsightExcel(report), {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="verzuim-${query.startDate}-${query.endDate}.xls"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AbsenceInsightsServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'INSIGHTS_ABSENCE_REPORT_FAILED' }, { status: 500 })
  }
}
