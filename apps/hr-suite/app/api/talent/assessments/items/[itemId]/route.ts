import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { updateTalentAssessmentItem } from '@/lib/talent/assessment-service'
import { talentAssessmentItemUpdateSchema } from '@/lib/talent/assessment-schemas'

export async function PATCH(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await context.params
    const parsed = talentAssessmentItemUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_ASSESSMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentAssessmentItem(itemId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_ASSESSMENT_ITEM_UPDATE_FAILED')
  }
}
