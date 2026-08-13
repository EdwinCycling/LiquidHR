import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { submitAssessment } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../../../guided-route'

type RouteContext = { params: Promise<{ assessmentId: string }> }

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-participation:write')
    const body = await request.json().catch(() => ({}))
    if (typeof body !== 'object' || body === null || typeof body.expectedVersion !== 'number') return invalidGuidedInput()
    const { assessmentId } = await params
    return NextResponse.json({ data: await submitAssessment(assessmentId, body.expectedVersion, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
