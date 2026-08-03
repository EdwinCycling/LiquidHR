import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { updateMyTalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import { talentEmployeeCapabilitySelfUpdateSchema } from '@/lib/talent/schemas'

export async function PATCH(request: Request, context: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await context.params
    const parsed = talentEmployeeCapabilitySelfUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateMyTalentEmployeeCapabilityRecord(recordId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_UPDATE_FAILED')
  }
}
