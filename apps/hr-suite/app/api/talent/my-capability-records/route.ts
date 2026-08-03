import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import {
  createMyTalentEmployeeCapabilityRecord,
  getMyTalentEmployeeCapabilityOptions,
  listMyTalentEmployeeCapabilityRecords,
} from '@/lib/talent/employee-capability-service'
import { talentEmployeeCapabilitySelfCreateSchema } from '@/lib/talent/schemas'

export async function GET() {
  try {
    return NextResponse.json({ data: await listMyTalentEmployeeCapabilityRecords() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = talentEmployeeCapabilitySelfCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createMyTalentEmployeeCapabilityRecord(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_CREATE_FAILED')
  }
}

export async function OPTIONS() {
  try {
    return NextResponse.json({ data: await getMyTalentEmployeeCapabilityOptions() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_OPTIONS_FAILED')
  }
}
