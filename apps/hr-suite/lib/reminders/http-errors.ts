import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ReminderServiceError } from './reminder-service'

export function reminderErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ReminderServiceError) {
    return NextResponse.json({ error: error.code }, { status: error.status })
  }
  return NextResponse.json({ error: 'REMINDER_OPERATION_FAILED' }, { status: 500 })
}
