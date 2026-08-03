import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentAssessmentWorkspace, updateTalentAssessmentCycle } from '@/lib/talent/assessment-service'
import { talentAssessmentCycleUpdateSchema, talentAssessmentListQuerySchema } from '@/lib/talent/assessment-schemas'

export async function GET(request: Request, context: { params: Promise<{ cycleId: string }> }) {
  try {
    const { cycleId } = await context.params
    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = talentAssessmentListQuerySchema.safeParse({ ...params, cycleId })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    const mode = parsed.data.responseType === 'SELF' ? 'self' : 'manager'
    return NextResponse.json({ data: await listTalentAssessmentWorkspace(mode, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_READ_FAILED')
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ cycleId: string }> }) {
  try {
    const { cycleId } = await context.params
    const parsed = talentAssessmentCycleUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentAssessmentCycle(cycleId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_CYCLE_UPDATE_FAILED')
  }
}
