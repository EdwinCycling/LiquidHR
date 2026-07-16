import { NextResponse } from 'next/server'
import { reminderErrorResponse } from '@/lib/reminders/http-errors'
import { publishReminder } from '@/lib/reminders/reminder-service'

interface RouteContext { params: Promise<{ reminderId: string }> }

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { reminderId } = await context.params
    return NextResponse.json({ data: { recipientCount: await publishReminder(reminderId) } })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}
