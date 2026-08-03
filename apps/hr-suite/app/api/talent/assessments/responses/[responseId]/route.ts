import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { commandTalentAssessmentResponse } from '@/lib/talent/assessment-service'
import { talentAssessmentResponseCommandSchema } from '@/lib/talent/assessment-schemas'

export async function PATCH(request: Request, context: { params: Promise<{ responseId: string }> }) {
  try {
    const { responseId } = await context.params
    const parsed = talentAssessmentResponseCommandSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await commandTalentAssessmentResponse(responseId, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_RESPONSE_COMMAND_FAILED')
  }
}
