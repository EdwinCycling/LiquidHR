import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { recruitmentGuidSchema } from '@/lib/recruitment/domain'
import { reopenRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:write')
    const { applicationId } = await params
    const body = await request.json().catch(() => null)
    const stageId = typeof body === 'object' && body !== null && 'stageId' in body ? recruitmentGuidSchema.safeParse(body.stageId) : { success: false as const }
    const expectedVersion = typeof body === 'object' && body !== null && 'expectedVersion' in body && typeof body.expectedVersion === 'number' ? body.expectedVersion : null
    const idempotencyKey = typeof body === 'object' && body !== null && 'idempotencyKey' in body && typeof body.idempotencyKey === 'string' ? body.idempotencyKey : crypto.randomUUID()
    if (!stageId.success || expectedVersion === null) return NextResponse.json({ code: 'RECRUITMENT_REOPEN_INPUT_INVALID' }, { status: 400 })
    const data = await reopenRecruitmentApplication(applicationId, stageId.data, expectedVersion, idempotencyKey, await createClient())
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
