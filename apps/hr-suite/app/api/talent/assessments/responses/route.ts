import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { saveTalentAssessmentResponse } from '@/lib/talent/assessment-service'
import { talentAssessmentResponseSaveSchema } from '@/lib/talent/assessment-schemas'

export async function POST(request: Request) {
  try {
    const parsed = talentAssessmentResponseSaveSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await saveTalentAssessmentResponse(parsed.data) }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_RESPONSE_SAVE_FAILED')
  }
}
