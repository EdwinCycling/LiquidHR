import { NextResponse } from 'next/server'
import { holidayErrorResponse, listHolidayCountries } from '@/lib/holidays/holiday-service'

export async function GET() {
  try { return NextResponse.json({ data: await listHolidayCountries() }) } catch (error) { return holidayErrorResponse(error) }
}
