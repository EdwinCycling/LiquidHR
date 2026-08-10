import { NextResponse } from 'next/server'
import { researchErrorResponse } from '@/lib/research/errors'
import { deleteEnpsBankQuestion, updateEnpsBankQuestion } from '@/lib/research/question-bank-service'
import { enpsBankQuestionInputSchema } from '@/lib/research/schemas'

type Context = { params: Promise<{ questionId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    const parsed = enpsBankQuestionInputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ENPS_BANK_QUESTION_INPUT_INVALID' }, { status: 400 })
    await updateEnpsBankQuestion((await params).questionId, parsed.data)
    return NextResponse.json({ updated: true })
  } catch (error) { return researchErrorResponse(error) }
}

export async function DELETE(_request: Request, { params }: Context) {
  try { await deleteEnpsBankQuestion((await params).questionId); return NextResponse.json({ deleted: true }) } catch (error) { return researchErrorResponse(error) }
}
