import { NextResponse } from 'next/server'
import { holidayErrorResponse, updateHoliday } from '@/lib/holidays/holiday-service'
import { holidayUpdateSchema } from '@/lib/holidays/schemas'
type Context = { params: Promise<{ holidayId: string }> }
export async function PATCH(request: Request, context: Context) { try { const parsed = holidayUpdateSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'HOLIDAY_INPUT_INVALID' }, { status: 400 }); await updateHoliday((await context.params).holidayId, parsed.data); return NextResponse.json({ data: { saved: true } }) } catch (error) { return holidayErrorResponse(error) } }
