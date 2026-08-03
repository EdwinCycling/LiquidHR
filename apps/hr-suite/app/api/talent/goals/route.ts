import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { createTalentGoal, listTalentGoals } from '@/lib/talent/goal-service'
import { talentGoalCreateSchema, talentGoalListQuerySchema } from '@/lib/talent/goal-schemas'

type GoalMode = 'admin' | 'manager' | 'self'

function modeFromRequest(request: Request): GoalMode {
  const mode = new URL(request.url).searchParams.get('mode')
  return mode === 'admin' || mode === 'self' ? mode : 'manager'
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = talentGoalListQuerySchema.safeParse({ employeeId: url.searchParams.get('employeeId') ?? undefined, status: url.searchParams.get('status') ?? undefined })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentGoals(modeFromRequest(request), parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_GOAL_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = talentGoalCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_GOAL_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentGoal(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_GOAL_CREATE_FAILED')
  }
}
