import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentSeniorityCreateSchema } from '@/lib/talent/schemas'
import { createTalentSeniority, listTalentSeniorities } from '@/lib/talent/service'

export async function GET() {
  try { return NextResponse.json({ data: await listTalentSeniorities() }) }
  catch (error) { return talentErrorResponse(error, 'TALENT_SENIORITY_READ_FAILED') }
}

export async function POST(request: Request) {
  try {
    const parsed = talentSeniorityCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentSeniority(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_SENIORITY_CREATE_FAILED')
  }
}
