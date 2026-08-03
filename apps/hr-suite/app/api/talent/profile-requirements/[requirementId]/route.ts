import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { jobProfileRequirementUpdateSchema } from '@/lib/talent/schemas'
import { deleteTalentProfileRequirement, updateTalentProfileRequirement } from '@/lib/talent/service'

export async function PATCH(request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  try {
    const parsed = jobProfileRequirementUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { requirementId } = await params
    return NextResponse.json({ data: await updateTalentProfileRequirement(requirementId, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_PROFILE_REQUIREMENT_UPDATE_FAILED')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  try {
    const { requirementId } = await params
    return NextResponse.json({ data: { id: await deleteTalentProfileRequirement(requirementId) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_PROFILE_REQUIREMENT_DELETE_FAILED')
  }
}
