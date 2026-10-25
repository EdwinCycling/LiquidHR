import { NextResponse } from 'next/server'
import { previewWorkCalendarSchema } from '@/lib/work-calendars/schemas'
import { previewWorkCalendar, workCalendarErrorResponse } from '@/lib/work-calendars/service'

export async function POST(request: Request) {
  try {
    const input = previewWorkCalendarSchema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ code: 'WORK_CALENDAR_INPUT_INVALID' },{ status: 400 })
    return NextResponse.json({ data: await previewWorkCalendar(input.data) })
  } catch (error) { return workCalendarErrorResponse(error) }
}
