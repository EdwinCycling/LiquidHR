import { NextResponse } from 'next/server'
import { updateEnpsDraft } from '@/lib/research/admin-service'
import { researchErrorResponse } from '@/lib/research/errors'
import { enpsCampaignInputSchema } from '@/lib/research/schemas'

export async function PUT(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const parsed = enpsCampaignInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_INPUT_INVALID', issues: parsed.error.issues }, { status: 400 })
    const { campaignId } = await params
    return NextResponse.json({ id: await updateEnpsDraft(campaignId, parsed.data) })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
