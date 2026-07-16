import { NextResponse } from 'next/server'
import { reminderErrorResponse } from '@/lib/reminders/http-errors'
import { updateRecipient } from '@/lib/reminders/reminder-service'
import { recipientActionSchema } from '@/lib/reminders/schemas'

interface RouteContext { params: Promise<{ recipientId: string }> }

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { recipientId } = await context.params
    const parsed = recipientActionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'REMINDER_INPUT_INVALID' }, { status: 400 })
    await updateRecipient(recipientId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}
