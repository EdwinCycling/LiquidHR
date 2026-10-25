import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listWorkCalendarHolidays, workCalendarErrorResponse } from '@/lib/work-calendars/service'

const rangeSchema = z.object({ from: z.string().date(), until: z.string().date() }).refine(value => value.until >= value.from && Date.parse(value.until)-Date.parse(value.from) <= 3660*86400000)
export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams
    const range = rangeSchema.safeParse({ from: search.get('from'), until: search.get('until') })
    if (!range.success) return NextResponse.json({ code: 'WORK_CALENDAR_INPUT_INVALID' },{ status: 400 })
    return NextResponse.json({ data: await listWorkCalendarHolidays(range.data.from,range.data.until) })
  } catch (error) { return workCalendarErrorResponse(error) }
}
