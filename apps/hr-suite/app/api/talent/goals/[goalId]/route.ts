import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { updateTalentGoal } from '@/lib/talent/goal-service'
import { talentGoalUpdateSchema } from '@/lib/talent/goal-schemas'

export async function PATCH(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const parsed = talentGoalUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    const { goalId } = await params
    await updateTalentGoal(goalId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_GOAL_UPDATE_FAILED')
  }
}
