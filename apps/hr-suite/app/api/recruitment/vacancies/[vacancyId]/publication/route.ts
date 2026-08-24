import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { publicationRequestSchema, updateRecruitmentPublication } from '@/lib/recruitment/vacancy-service'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ vacancyId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-vacancy:publish')
    const { vacancyId } = await params
    const parsed = publicationRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_PUBLICATION_INPUT_INVALID' }, { status: 400 })
    const result = await updateRecruitmentPublication(context, vacancyId, parsed.data.status, parsed.data.slug ?? null, parsed.data.payload, await createClient())
    return NextResponse.json({ data: result })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
