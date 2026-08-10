import { NextResponse } from 'next/server'
import { createEnpsCampaign } from '@/lib/research/admin-service'
import { researchErrorResponse } from '@/lib/research/errors'
import { enpsCampaignInputSchema } from '@/lib/research/schemas'

export async function POST(request: Request) {
  try {
    const parsed = enpsCampaignInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_INPUT_INVALID', issues: parsed.error.issues }, { status: 400 })
    return NextResponse.json({ id: await createEnpsCampaign(parsed.data) }, { status: 201 })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
