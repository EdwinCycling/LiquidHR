import { NextResponse } from 'next/server'
import { researchErrorResponse } from '@/lib/research/errors'
import { createEnpsBankCategory } from '@/lib/research/question-bank-service'
import { enpsBankCategoryInputSchema } from '@/lib/research/schemas'

export async function POST(request: Request) {
  try {
    const parsed = enpsBankCategoryInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_BANK_CATEGORY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ id: await createEnpsBankCategory(parsed.data) }, { status: 201 })
  } catch (error) { return researchErrorResponse(error) }
}
