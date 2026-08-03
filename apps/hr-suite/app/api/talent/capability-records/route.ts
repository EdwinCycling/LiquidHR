import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import {
  createTalentEmployeeCapabilityRecord,
  getTalentEmployeeCapabilityOptions,
  listTalentEmployeeCapabilityRecords,
} from '@/lib/talent/employee-capability-service'
import { talentEmployeeCapabilityAdminCreateSchema, talentEmployeeCapabilityListQuerySchema } from '@/lib/talent/schemas'

export async function GET(request: Request) {
  try {
    const parsed = talentEmployeeCapabilityListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentEmployeeCapabilityRecords(parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = talentEmployeeCapabilityAdminCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createTalentEmployeeCapabilityRecord(parsed.data) } }, { status: 201 })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_CREATE_FAILED')
  }
}

export async function OPTIONS() {
  try {
    return NextResponse.json({ data: await getTalentEmployeeCapabilityOptions() })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EMPLOYEE_CAPABILITY_OPTIONS_FAILED')
  }
}
