import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentSeniorityUpdateSchema } from '@/lib/talent/schemas'
import { deleteTalentSeniority, updateTalentSeniority } from '@/lib/talent/service'

export async function PATCH(request: Request, context: { params: Promise<{ seniorityId: string }> }) {
  try {
    const { seniorityId } = await context.params
    const parsed = talentSeniorityUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentSeniority(seniorityId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_SENIORITY_UPDATE_FAILED') }
}

export async function DELETE(_request: Request, context: { params: Promise<{ seniorityId: string }> }) {
  try {
    const { seniorityId } = await context.params
    return NextResponse.json({ data: { id: await deleteTalentSeniority(seniorityId) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_SENIORITY_DELETE_FAILED') }
}
