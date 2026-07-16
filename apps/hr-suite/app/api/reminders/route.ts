import { NextResponse } from 'next/server'
import { z } from 'zod'
import { reminderErrorResponse } from '@/lib/reminders/http-errors'
import {
  createHrReminder,
  createPersonalReminder,
  listMyReminders,
} from '@/lib/reminders/reminder-service'
import { hrReminderCreateSchema, personalReminderCreateSchema } from '@/lib/reminders/schemas'

const typeSchema = z.object({ type: z.enum(['PERSONAL', 'HR']) }).passthrough()

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit') ?? 100)
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100
    return NextResponse.json({ data: await listMyReminders(limit) })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const typed = typeSchema.safeParse(body)
    if (!typed.success) return NextResponse.json({ error: 'REMINDER_INPUT_INVALID' }, { status: 400 })
    const { type, ...input } = typed.data
    if (type === 'PERSONAL') {
      const parsed = personalReminderCreateSchema.safeParse(input)
      if (!parsed.success) return NextResponse.json({ error: 'REMINDER_INPUT_INVALID' }, { status: 400 })
      return NextResponse.json({ data: { id: await createPersonalReminder(parsed.data) } }, { status: 201 })
    }
    const parsed = hrReminderCreateSchema.safeParse(input)
    if (!parsed.success) return NextResponse.json({ error: 'REMINDER_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createHrReminder(parsed.data) } }, { status: 201 })
  } catch (error) {
    return reminderErrorResponse(error)
  }
}
