import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { returnTalentReviewAssignment } from '@/lib/talent-review/service'
import { talentReviewReturnSchema } from '@/lib/talent-review/schemas'

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewReturnSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await returnTalentReviewAssignment(campaignId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
