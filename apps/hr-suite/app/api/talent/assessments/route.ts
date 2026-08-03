import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { createTalentAssessmentCycle, listTalentAssessmentWorkspace } from '@/lib/talent/assessment-service'
import { talentAssessmentCycleCreateSchema, talentAssessmentListQuerySchema } from '@/lib/talent/assessment-schemas'

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = talentAssessmentListQuerySchema.safeParse(params)
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    const mode = parsed.data.responseType === 'SELF' ? 'self' : 'manager'
    return NextResponse.json({ data: await listTalentAssessmentWorkspace(mode, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = talentAssessmentCycleCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentAssessmentCycle(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_CYCLE_CREATE_FAILED')
  }
}
