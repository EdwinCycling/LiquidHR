import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { saveTalentReviewScore } from '@/lib/talent-review/service'
import { talentReviewScoreSaveSchema } from '@/lib/talent-review/schemas'

export async function PUT(request: Request, context: { params: Promise<{ campaignId: string; employeeId: string }> }) {
  try {
    const { campaignId, employeeId } = await context.params
    const parsed = talentReviewScoreSaveSchema.safeParse({ ...(await request.json()), employeeId })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await saveTalentReviewScore(campaignId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
