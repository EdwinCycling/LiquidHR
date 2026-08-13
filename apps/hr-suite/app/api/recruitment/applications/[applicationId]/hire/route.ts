import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { hireRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { hireChoiceSchema, requireHumanHireChoice } from '@/lib/recruitment/employee-link-service'

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:write')
    const { applicationId } = await params
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null) return NextResponse.json({ code: 'RECRUITMENT_HIRE_INPUT_INVALID' }, { status: 400 })
    const choice = hireChoiceSchema.safeParse({ choice: 'choice' in body ? body.choice : undefined, employeeId: 'employeeId' in body ? body.employeeId : null })
    const administrationId = 'administrationId' in body && typeof body.administrationId === 'string' ? body.administrationId : null
    const employmentId = 'employmentId' in body && typeof body.employmentId === 'string' ? body.employmentId : null
    const expectedVersion = 'expectedVersion' in body && typeof body.expectedVersion === 'number' ? body.expectedVersion : null
    if (!choice.success || !administrationId || expectedVersion === null) return NextResponse.json({ code: 'RECRUITMENT_HIRE_INPUT_INVALID' }, { status: 400 })
    const explicit = requireHumanHireChoice(choice.data)
    if (!explicit.employeeId) return NextResponse.json({ code: 'RECRUITMENT_EMPLOYEE_CREATE_REQUIRED' }, { status: 409 })
    const data = await hireRecruitmentApplication(applicationId, administrationId, explicit.employeeId, employmentId, expectedVersion, crypto.randomUUID(), await createClient())
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
