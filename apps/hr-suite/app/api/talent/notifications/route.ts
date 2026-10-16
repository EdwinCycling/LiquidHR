import { NextResponse } from 'next/server'
import { countTalentNotifications, listTalentNotifications } from '@/lib/talent/notification-service'
import { talentErrorResponse } from '@/lib/talent/route'

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('summary') === 'true') {
      return NextResponse.json({ count: await countTalentNotifications() })
    }
    return NextResponse.json({ data: await listTalentNotifications() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_NOTIFICATION_READ_FAILED')
  }
}
