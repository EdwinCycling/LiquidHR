import { NextResponse } from 'next/server'
import { publishWorkCalendarSchema } from '@/lib/work-calendars/schemas'
import { getWorkCalendars, publishWorkCalendar, workCalendarErrorResponse } from '@/lib/work-calendars/service'

export async function GET() {
  try { return NextResponse.json({ data: await getWorkCalendars() }) } catch (error) { return workCalendarErrorResponse(error) }
}
export async function POST(request: Request) {
  try {
    const input = publishWorkCalendarSchema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ code: 'WORK_CALENDAR_INPUT_INVALID' },{ status: 400 })
    return NextResponse.json({ data: await publishWorkCalendar(input.data) },{ status: 201 })
  } catch (error) { return workCalendarErrorResponse(error) }
}
