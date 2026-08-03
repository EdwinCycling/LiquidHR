import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCategoryCreateSchema } from '@/lib/talent/schemas'
import { createTalentCategory, listTalentCategories } from '@/lib/talent/service'

export async function GET() {
  try { return NextResponse.json({ data: await listTalentCategories() }) }
  catch (error) { return talentErrorResponse(error, 'TALENT_CATEGORY_READ_FAILED') }
}

export async function POST(request: Request) {
  try {
    const parsed = talentCategoryCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentCategory(parsed.data) } }, { status: 201 })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CATEGORY_CREATE_FAILED') }
}
