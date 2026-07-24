import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getEmployeeInsightReport, EmployeeInsightsServiceError } from '@/lib/insights/employee-report-service'
import { employeeInsightCsv } from '@/lib/insights/csv'
import { parseEmployeeInsightQuery } from '@/lib/insights/query'

function csvResponse(data: Awaited<ReturnType<typeof getEmployeeInsightReport>>): NextResponse {
  return new NextResponse(employeeInsightCsv(data.rows), {
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
