import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { submitTalentReviewAssignment } from '@/lib/talent-review/service'

export async function POST(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    return NextResponse.json({ data: { id: await submitTalentReviewAssignment(campaignId) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
