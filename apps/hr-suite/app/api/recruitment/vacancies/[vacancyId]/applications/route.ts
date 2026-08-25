import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createManualRecruitmentApplication, listRecruitmentVacancyPipeline, manualApplicationInputSchema } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const requestContext = await getRequestAuthorizationContext()
    await requirePermission('recruitment-candidate:read')
    const { vacancyId } = await params
    const pipeline = await listRecruitmentVacancyPipeline(requestContext.context, vacancyId, requestContext.supabase)
    return NextResponse.json({ data: pipeline.applications, stages: pipeline.stages, vacancy: { id: pipeline.vacancyId, title: pipeline.vacancyTitle } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return responseFor(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-candidate:write')
    const { vacancyId } = await params
    const body = await request.json().catch(() => null)
    const parsed = manualApplicationInputSchema.safeParse({ ...(typeof body === 'object' && body !== null ? body : {}), vacancyId, source: 'MANUAL' })
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_APPLICATION_INPUT_INVALID' }, { status: 400 })
    const data = await createManualRecruitmentApplication(context, parsed.data, await createClient())
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return responseFor(error)
  }
}

function responseFor(error: unknown): NextResponse {
  return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
}
