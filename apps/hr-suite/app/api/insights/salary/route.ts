import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryInsightCsv } from '@/lib/insights/salary-insights-csv'
import { parseSalaryInsightQuery } from '@/lib/insights/salary-insights-query'
import { getSalaryInsightsReport, SalaryInsightsServiceError } from '@/lib/insights/salary-insights-service'

export async function GET(request: Request) {
  const query = parseSalaryInsightQuery(new URL(request.url).searchParams)
  if (!query) return NextResponse.json({ error: 'SALARY_INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    const report = await getSalaryInsightsReport(query)
    if (new URL(request.url).searchParams.get('format') === 'csv') {
      return new NextResponse(salaryInsightCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${report.report}-${report.asOfDate}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryInsightsServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'SALARY_INSIGHTS_FAILED' }, { status: 500 })
  }
}
