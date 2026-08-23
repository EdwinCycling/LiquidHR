import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { getTalentGoal, updateTalentGoal } from '@/lib/talent/goal-service'
import { talentGoalIdSchema, talentGoalUpdateSchema } from '@/lib/talent/goal-schemas'

type GoalMode = 'admin' | 'manager' | 'self'

function modeFromRequest(request: Request): GoalMode {
  const mode = new URL(request.url).searchParams.get('mode')
  return mode === 'admin' || mode === 'self' ? mode : 'manager'
}

export async function GET(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const { goalId } = await params
    if (!talentGoalIdSchema.safeParse(goalId).success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getTalentGoal(goalId, modeFromRequest(request)) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_GOAL_READ_FAILED')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const parsed = talentGoalUpdateSchema.safeParse(await request.json().catch(() => null) as unknown)
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    const { goalId } = await params
    if (!talentGoalIdSchema.safeParse(goalId).success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    await updateTalentGoal(goalId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_GOAL_UPDATE_FAILED')
  }
}
