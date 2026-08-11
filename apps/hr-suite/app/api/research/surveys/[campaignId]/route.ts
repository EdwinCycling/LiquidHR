import { NextResponse } from 'next/server'
import { updateSurveyDraft } from '@/lib/research/admin-service'
import { researchErrorResponse } from '@/lib/research/errors'
import { surveyInputSchema } from '@/lib/research/schemas'

export async function PUT(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const parsed = surveyInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'SURVEY_INPUT_INVALID', issues: parsed.error.issues }, { status: 400 })
    const { campaignId } = await params
    return NextResponse.json({ id: await updateSurveyDraft(campaignId, parsed.data) })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
