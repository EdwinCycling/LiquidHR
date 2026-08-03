import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { jobProfileRequirementCreateSchema } from '@/lib/talent/schemas'
import { addTalentProfileRequirement } from '@/lib/talent/service'

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const parsed = jobProfileRequirementCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { versionId } = await params
    return NextResponse.json({ data: await addTalentProfileRequirement(versionId, parsed.data) }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_PROFILE_REQUIREMENT_CREATE_FAILED')
  }
}
