import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { upcomingEventsCsv } from '@/lib/insights/upcoming-events-csv'
import { getUpcomingEventsReport, UpcomingEventsServiceError } from '@/lib/insights/upcoming-events'
import { parseUpcomingEventsQuery } from '@/lib/insights/upcoming-events-query'

export async function GET(request: Request) {
  try {
    const report = await getUpcomingEventsReport(parseUpcomingEventsQuery(new URL(request.url).searchParams))
    if (new URL(request.url).searchParams.get('format') === 'csv') {
      return new NextResponse(upcomingEventsCsv(report), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="aankomende-gebeurtenissen-${report.startDate}.csv"`, 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ data: report })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof UpcomingEventsServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'UPCOMING_EVENTS_READ_FAILED' }, { status: 500 })
  }
}
