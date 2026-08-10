import { NextResponse } from 'next/server'
import { researchErrorResponse } from '@/lib/research/errors'
import { deleteEnpsBankCategory, updateEnpsBankCategory } from '@/lib/research/question-bank-service'
import { enpsBankCategoryInputSchema } from '@/lib/research/schemas'

type Context = { params: Promise<{ categoryId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    const parsed = enpsBankCategoryInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_BANK_CATEGORY_INPUT_INVALID' }, { status: 400 })
    await updateEnpsBankCategory((await params).categoryId, parsed.data)
    return NextResponse.json({ updated: true })
  } catch (error) { return researchErrorResponse(error) }
}

export async function DELETE(_request: Request, { params }: Context) {
  try { await deleteEnpsBankCategory((await params).categoryId); return NextResponse.json({ deleted: true }) } catch (error) { return researchErrorResponse(error) }
}
