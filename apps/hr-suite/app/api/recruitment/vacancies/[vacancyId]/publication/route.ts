import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { updateRecruitmentPublication } from '@/lib/recruitment/vacancy-service'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-vacancy:publish')
    const { vacancyId } = await params
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || !('status' in body) || !['OPEN', 'CLOSED', 'ARCHIVED'].includes(String(body.status))) return NextResponse.json({ code: 'RECRUITMENT_PUBLICATION_INPUT_INVALID' }, { status: 400 })
    const status = String(body.status) as 'OPEN' | 'CLOSED' | 'ARCHIVED'
    const slug = 'slug' in body && typeof body.slug === 'string' ? body.slug : null
    const payload = 'payload' in body && typeof body.payload === 'object' && body.payload !== null ? body.payload as Record<string, unknown> : {}
    const result = await updateRecruitmentPublication(context, vacancyId, status, slug, payload, await createClient())
    return NextResponse.json({ data: result })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
