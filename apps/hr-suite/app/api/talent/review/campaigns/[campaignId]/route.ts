import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentReviewWorkspace, updateTalentReviewCampaign } from '@/lib/talent-review/service'
import { talentReviewCampaignUpdateSchema, talentReviewListQuerySchema } from '@/lib/talent-review/schemas'

export async function GET(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewListQuerySchema.safeParse({ campaignId })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentReviewWorkspace('hr', parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_READ_FAILED')
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewCampaignUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentReviewCampaign(campaignId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
