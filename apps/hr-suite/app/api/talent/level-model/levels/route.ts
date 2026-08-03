import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentLevelCreateSchema, talentLevelReorderSchema } from '@/lib/talent/schemas'
import { createTalentLevel, reorderTalentLevels } from '@/lib/talent/service'

export async function POST(request: Request) {
  try {
    const parsed = talentLevelCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentLevel(parsed.data) } }, { status: 201 })
  } catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_CREATE_FAILED') }
}

export async function PUT(request: Request) {
  try {
    const parsed = talentLevelReorderSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    await reorderTalentLevels(parsed.data)
    return NextResponse.json({ data: { saved: true } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_REORDER_FAILED') }
}
