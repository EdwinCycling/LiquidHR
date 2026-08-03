import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCapabilityCreateSchema, talentCapabilityListQuerySchema } from '@/lib/talent/schemas'
import { createTalentCapability, listTalentCapabilities } from '@/lib/talent/service'

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const parsed = talentCapabilityListQuerySchema.safeParse(Object.fromEntries(query.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentCapabilities(parsed.data) })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_READ_FAILED') }
}

export async function POST(request: Request) {
  try {
    const parsed = talentCapabilityCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentCapability(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_CAPABILITY_CREATE_FAILED')
  }
}
