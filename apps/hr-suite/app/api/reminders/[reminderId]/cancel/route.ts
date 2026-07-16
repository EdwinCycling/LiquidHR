import { NextResponse } from 'next/server'
import { reminderErrorResponse } from '@/lib/reminders/http-errors'
import { cancelHrReminder } from '@/lib/reminders/reminder-service'

interface RouteContext { params: Promise<{ reminderId: string }> }

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { reminderId } = await context.params
    await cancelHrReminder(reminderId)
    return NextResponse.json({ data: { cancelled: true } })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}
