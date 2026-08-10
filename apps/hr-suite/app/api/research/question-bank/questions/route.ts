import { NextResponse } from 'next/server'
import { researchErrorResponse } from '@/lib/research/errors'
import { createEnpsBankQuestion } from '@/lib/research/question-bank-service'
import { enpsBankQuestionInputSchema } from '@/lib/research/schemas'

export async function POST(request: Request) {
  try {
    const parsed = enpsBankQuestionInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_BANK_QUESTION_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ id: await createEnpsBankQuestion(parsed.data) }, { status: 201 })
  } catch (error) { return researchErrorResponse(error) }
}
