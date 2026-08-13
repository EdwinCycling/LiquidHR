import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAnyPermission, requirePermission, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { getRecruitmentVacancy, saveRecruitmentVacancy, vacancyInputSchema } from '@/lib/recruitment/vacancy-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

type RouteContext = { params: Promise<{ vacancyId: string }> }

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read'])
    const { vacancyId } = await params
    const vacancy = await getRecruitmentVacancy(requestContext.context, vacancyId, requestContext.supabase)
    if (!vacancy) return NextResponse.json({ code: 'RECRUITMENT_VACANCY_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data: vacancy }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return responseFor(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-vacancy:write')
    const { vacancyId } = await params
    const body = await request.json().catch(() => null)
    const expectedVersion = typeof body === 'object' && body !== null && 'expectedVersion' in body && typeof body.expectedVersion === 'number' ? body.expectedVersion : null
    const input = typeof body === 'object' && body !== null && 'input' in body ? body.input : null
    const parsed = vacancyInputSchema.safeParse(input)
    if (!parsed.success || expectedVersion === null) return NextResponse.json({ code: 'RECRUITMENT_VACANCY_INPUT_INVALID' }, { status: 400 })
    const result = await saveRecruitmentVacancy(context, parsed.data, await createClient(), vacancyId, expectedVersion)
    return NextResponse.json({ data: result })
  } catch (error) {
    return responseFor(error)
  }
}

function responseFor(error: unknown): NextResponse {
  return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
}
