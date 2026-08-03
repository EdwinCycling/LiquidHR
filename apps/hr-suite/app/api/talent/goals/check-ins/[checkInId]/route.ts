import { NextResponse } from 'next/server'
import { updateTalentGoalCheckIn } from '@/lib/talent/check-in-service'
import { talentCheckInUpdateSchema } from '@/lib/talent/check-in-schemas'
import { talentErrorResponse } from '@/lib/talent/route'

export async function PATCH(request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
  try {
    const parsed = talentCheckInUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_CHECKIN_INPUT_INVALID' }, { status: 400 })
    const { checkInId } = await params
    await updateTalentGoalCheckIn(checkInId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_CHECKIN_UPDATE_FAILED')
  }
}
