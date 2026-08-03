import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCategoryUpdateSchema } from '@/lib/talent/schemas'
import { deleteTalentCategory, updateTalentCategory } from '@/lib/talent/service'

export async function PATCH(request: Request, context: { params: Promise<{ categoryId: string }> }) {
  try {
    const { categoryId } = await context.params
    const parsed = talentCategoryUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentCategory(categoryId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CATEGORY_UPDATE_FAILED') }
}

export async function DELETE(_request: Request, context: { params: Promise<{ categoryId: string }> }) {
  try {
    const { categoryId } = await context.params
    return NextResponse.json({ data: { id: await deleteTalentCategory(categoryId) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CATEGORY_DELETE_FAILED') }
}
