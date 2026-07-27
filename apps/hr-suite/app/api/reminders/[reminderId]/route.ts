import { NextResponse } from 'next/server'
import { reminderErrorResponse } from '@/lib/reminders/http-errors'
import { deleteReminder, updateReminder } from '@/lib/reminders/reminder-service'
import { reminderUpdateSchema } from '@/lib/reminders/schemas'

interface RouteContext { params: Promise<{ reminderId: string }> }

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { reminderId } = await context.params
    const parsed = reminderUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'REMINDER_INPUT_INVALID' }, { status: 400 })
    await updateReminder(reminderId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { reminderId } = await context.params
    await deleteReminder(reminderId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}
