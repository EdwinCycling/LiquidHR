import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { rejectRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:write')
    const { applicationId } = await params
    const body = await request.json().catch(() => null)
    const reason = typeof body === 'object' && body !== null && 'reason' in body && typeof body.reason === 'string' ? body.reason.trim() : ''
    const expectedVersion = typeof body === 'object' && body !== null && 'expectedVersion' in body && typeof body.expectedVersion === 'number' ? body.expectedVersion : null
    const idempotencyKey = typeof body === 'object' && body !== null && 'idempotencyKey' in body && typeof body.idempotencyKey === 'string' ? body.idempotencyKey : crypto.randomUUID()
    if (!reason || expectedVersion === null) return NextResponse.json({ code: 'RECRUITMENT_REJECT_INPUT_INVALID' }, { status: 400 })
    const data = await rejectRecruitmentApplication(applicationId, reason, expectedVersion, idempotencyKey, await createClient())
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error) ?? (error instanceof RecruitmentError ? NextResponse.json({ code: error.code }, { status: error.status }) : (() => { throw error })())
  }
}
