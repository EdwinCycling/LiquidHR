import { NextResponse } from 'next/server'
import { createSurvey } from '@/lib/research/admin-service'
import { researchErrorResponse } from '@/lib/research/errors'
import { surveyInputSchema } from '@/lib/research/schemas'

export async function POST(request: Request) {
  try {
    const parsed = surveyInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'SURVEY_INPUT_INVALID', issues: parsed.error.issues }, { status: 400 })
    return NextResponse.json({ id: await createSurvey(parsed.data) }, { status: 201 })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
