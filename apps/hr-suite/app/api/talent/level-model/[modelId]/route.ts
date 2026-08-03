import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentLevelModelUpdateSchema } from '@/lib/talent/schemas'
import { updateTalentLevelModel } from '@/lib/talent/service'

export async function PATCH(request: Request, context: { params: Promise<{ modelId: string }> }) {
  try {
    const { modelId } = await context.params
    const parsed = talentLevelModelUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentLevelModel(modelId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_MODEL_UPDATE_FAILED') }
}
