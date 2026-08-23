import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { createTalentAssessmentItem } from '@/lib/talent/assessment-service'
import { talentAssessmentItemCreateSchema } from '@/lib/talent/assessment-schemas'

export async function POST(request: Request, context: { params: Promise<{ cycleId: string }> }) {
  try {
    const { cycleId } = await context.params
    const parsed = talentAssessmentItemCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentAssessmentItem(cycleId, parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_ITEM_CREATE_FAILED')
  }
}
