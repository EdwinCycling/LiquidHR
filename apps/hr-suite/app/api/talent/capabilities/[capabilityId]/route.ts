import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { talentCapabilityUpdateSchema } from '@/lib/talent/schemas'
import { deleteTalentCapability, getTalentCapability, updateTalentCapability } from '@/lib/talent/service'

export async function GET(_request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  try {
    const { capabilityId } = await context.params
    return NextResponse.json({ data: await getTalentCapability(capabilityId) })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_READ_FAILED') }
}

export async function PATCH(request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  try {
    const { capabilityId } = await context.params
    const parsed = talentCapabilityUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentCapability(capabilityId, parsed.data) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_UPDATE_FAILED') }
}

export async function DELETE(_request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  try {
    const { capabilityId } = await context.params
    return NextResponse.json({ data: { id: await deleteTalentCapability(capabilityId) } })
  } catch (error) { return talentErrorResponse(error, 'TALENT_CAPABILITY_DELETE_FAILED') }
}
