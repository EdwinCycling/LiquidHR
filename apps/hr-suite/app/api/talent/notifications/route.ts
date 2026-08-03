import { NextResponse } from 'next/server'
import { listTalentNotifications } from '@/lib/talent/notification-service'
import { talentErrorResponse } from '@/lib/talent/route'

export async function GET() {
  try {
    return NextResponse.json({ data: await listTalentNotifications() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_NOTIFICATION_READ_FAILED')
  }
}
