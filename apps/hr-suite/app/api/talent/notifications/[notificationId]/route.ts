import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateTalentNotification } from '@/lib/talent/notification-service'
import { talentErrorResponse } from '@/lib/talent/route'

const notificationUpdateSchema = z.object({ status: z.enum(['READ', 'DONE', 'DISMISSED']) }).strict()

export async function PATCH(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  try {
    const parsed = notificationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_NOTIFICATION_INPUT_INVALID' }, { status: 400 })
    const { notificationId } = await params
    await updateTalentNotification(notificationId, parsed.data.status)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_NOTIFICATION_UPDATE_FAILED')
  }
}
