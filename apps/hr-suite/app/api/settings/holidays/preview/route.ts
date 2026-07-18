import { NextResponse } from 'next/server'
import { holidayErrorResponse, previewHolidayImport } from '@/lib/holidays/holiday-service'
import { holidayImportSchema } from '@/lib/holidays/schemas'
export async function GET(request: Request) { try { const url = new URL(request.url); const parsed = holidayImportSchema.safeParse({ year: Number(url.searchParams.get('year')), countryCode: url.searchParams.get('country') }); if (!parsed.success) return NextResponse.json({ error: 'HOLIDAY_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: await previewHolidayImport(parsed.data) }) } catch (error) { return holidayErrorResponse(error) } }
