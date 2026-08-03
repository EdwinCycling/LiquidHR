import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentLevelUpdateSchema } from '@/lib/talent/schemas'
import { deleteTalentLevel, updateTalentLevel } from '@/lib/talent/service'

export async function PATCH(request: Request, context: { params: Promise<{ levelId: string }> }) {
  try {
    const { levelId } = await context.params
    const parsed = talentLevelUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentLevel(levelId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_UPDATE_FAILED') }
}

export async function DELETE(_request: Request, context: { params: Promise<{ levelId: string }> }) {
  try {
    const { levelId } = await context.params
    return NextResponse.json({ data: { id: await deleteTalentLevel(levelId) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_DELETE_FAILED') }
}
