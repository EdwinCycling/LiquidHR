import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { createTalentReviewCampaign, listTalentReviewWorkspace } from '@/lib/talent-review/service'
import { talentReviewCampaignCreateSchema, talentReviewListQuerySchema } from '@/lib/talent-review/schemas'

export async function GET(request: Request) {
  try {
    const parsed = talentReviewListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentReviewWorkspace('hr', parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = talentReviewCampaignCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentReviewCampaign(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
