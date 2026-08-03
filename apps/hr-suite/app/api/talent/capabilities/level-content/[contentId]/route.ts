import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { deleteTalentCapabilityLevelContent } from '@/lib/talent/service'

export async function DELETE(_request: Request, context: { params: Promise<{ contentId: string }> }) {
  try {
    const { contentId } = await context.params
    return NextResponse.json({ data: { id: await deleteTalentCapabilityLevelContent(contentId) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_LEVEL_CONTENT_DELETE_FAILED') }
}
