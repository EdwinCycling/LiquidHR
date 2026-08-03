import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentReviewWorkspace } from '@/lib/talent-review/service'
import { talentReviewListQuerySchema } from '@/lib/talent-review/schemas'

export async function GET(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewListQuerySchema.safeParse({ campaignId })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    const mode = new URL(request.url).searchParams.get('mode') === 'hr' ? 'hr' : 'manager'
    return NextResponse.json({ data: await listTalentReviewWorkspace(mode, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_READ_FAILED')
  }
}
