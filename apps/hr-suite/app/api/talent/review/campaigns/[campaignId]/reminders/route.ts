import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { sendTalentReviewReminder } from '@/lib/talent-review/service'
import { talentReviewReminderSchema } from '@/lib/talent-review/schemas'

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params
    const parsed = talentReviewReminderSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_REVIEW_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await sendTalentReviewReminder(campaignId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REVIEW_WRITE_FAILED')
  }
}
