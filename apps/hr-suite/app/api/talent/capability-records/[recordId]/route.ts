import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { updateTalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import { talentEmployeeCapabilityAdminUpdateSchema } from '@/lib/talent/schemas'

export async function PATCH(request: Request, context: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await context.params
    const parsed = talentEmployeeCapabilityAdminUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateTalentEmployeeCapabilityRecord(recordId, parsed.data) } })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_UPDATE_FAILED')
  }
}
