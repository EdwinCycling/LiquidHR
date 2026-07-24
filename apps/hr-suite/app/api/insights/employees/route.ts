import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getEmployeeInsightReport, EmployeeInsightsServiceError } from '@/lib/insights/employee-report-service'
import { parseEmployeeInsightQuery } from '@/lib/insights/query'

function csvCell(value: string | number | null): string {
  const source = value === null ? '' : String(value)
  return `"${source.replaceAll('"', '""')}"`
}

function csvResponse(data: Awaited<ReturnType<typeof getEmployeeInsightReport>>): NextResponse {
  const headers = ['Medewerker', 'Geslacht', 'Leeftijd', 'Team', 'Segment', 'Einddatum', 'Reden']
  const lines = [headers.map(csvCell).join(',')]
  for (const row of data.rows) {
    lines.push([row.employeeName, row.gender, row.age, row.team, row.segment, row.endDate, row.reason].map(csvCell).join(','))
  }
  return new NextResponse(`\uFEFF${lines.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${data.report}-${data.period.startDate}-${data.period.endDate}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: Request) {
  const query = parseEmployeeInsightQuery(new URL(request.url).searchParams)
  if (!query) return NextResponse.json({ error: 'INSIGHTS_REPORT_REQUIRED' }, { status: 400 })
  try {
    const data = await getEmployeeInsightReport(query)
    return new URL(request.url).searchParams.get('format') === 'csv' ? csvResponse(data) : NextResponse.json({ data })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmployeeInsightsServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'INSIGHTS_EMPLOYEE_REPORT_FAILED' }, { status: 500 })
  }
}
