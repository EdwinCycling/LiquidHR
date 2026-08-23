import { NextResponse } from 'next/server'
import { createTalentGoalCheckIn, listTalentGoalCheckIns } from '@/lib/talent/check-in-service'
import { talentCheckInCreateSchema } from '@/lib/talent/check-in-schemas'
import { talentGoalIdSchema } from '@/lib/talent/goal-schemas'
import { talentErrorResponse } from '@/lib/talent/route'

export async function GET(_request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const { goalId } = await params
    if (!talentGoalIdSchema.safeParse(goalId).success) return NextResponse.json({ error: 'TALENT_CHECKIN_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentGoalCheckIns(goalId) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_CHECKIN_READ_FAILED')
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const parsed = talentCheckInCreateSchema.safeParse(await request.json().catch(() => null) as unknown)
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_CHECKIN_INPUT_INVALID' }, { status: 400 })
    const { goalId } = await params
    if (!talentGoalIdSchema.safeParse(goalId).success) return NextResponse.json({ error: 'TALENT_CHECKIN_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentGoalCheckIn(goalId, parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_CHECKIN_CREATE_FAILED')
  }
}
