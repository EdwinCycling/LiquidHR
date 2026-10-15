import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { submitTalentReviewAssignment } from '@/lib/talent-review/service'
import { talentReviewSubmitSchema } from '@/lib/talent-review/schemas'

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewSubmitSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await submitTalentReviewAssignment(campaignId, parsed.data.assignmentId) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
