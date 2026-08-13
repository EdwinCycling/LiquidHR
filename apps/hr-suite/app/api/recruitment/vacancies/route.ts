import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { listRecruitmentVacancies, saveRecruitmentVacancy, vacancyInputSchema } from '@/lib/recruitment/vacancy-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read'])
    return NextResponse.json({ data: await listRecruitmentVacancies(requestContext.context, requestContext.supabase) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return permissionErrorResponse(error) ?? recruitmentErrorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-vacancy:write')
    const parsed = vacancyInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_VACANCY_INPUT_INVALID' }, { status: 400 })
    const id = await saveRecruitmentVacancy(context, parsed.data, await createClient())
    return NextResponse.json({ data: id }, { status: 201 })
  } catch (error) {
    return permissionErrorResponse(error) ?? recruitmentErrorResponse(error)
  }
}

function recruitmentErrorResponse(error: unknown): NextResponse {
  if (error instanceof RecruitmentError) return NextResponse.json({ code: error.code }, { status: error.status })
  throw error
}
