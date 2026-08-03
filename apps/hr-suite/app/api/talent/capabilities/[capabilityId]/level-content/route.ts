import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCapabilityLevelContentSchema } from '@/lib/talent/schemas'
import { saveTalentCapabilityLevelContent } from '@/lib/talent/service'

export async function PUT(request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  try {
    const { capabilityId } = await context.params
    const parsed = talentCapabilityLevelContentSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await saveTalentCapabilityLevelContent(capabilityId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_LEVEL_CONTENT_SAVE_FAILED') }
}
