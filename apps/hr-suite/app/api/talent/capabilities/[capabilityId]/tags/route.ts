import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCapabilityTagSchema } from '@/lib/talent/schemas'
import { replaceTalentCapabilityTags } from '@/lib/talent/service'

export async function PUT(request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  try {
    const { capabilityId } = await context.params
    const body: unknown = await request.json()
    if (!Array.isArray(body)) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const parsedTags = body.map((item: unknown) => talentCapabilityTagSchema.safeParse(item))
    if (parsedTags.some((item) => !item.success)) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const tags = parsedTags.flatMap((item) => item.success ? [item.data] : [])
    await replaceTalentCapabilityTags(capabilityId, tags)
    return NextResponse.json({ data: { saved: true } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_TAG_SAVE_FAILED') }
}
