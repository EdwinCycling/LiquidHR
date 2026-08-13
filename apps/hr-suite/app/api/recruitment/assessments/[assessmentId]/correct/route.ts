import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { correctAssessment } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../../../guided-route'

type RouteContext = { params: Promise<{ assessmentId: string }> }

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-assessment:write')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.reason !== 'string' || !Array.isArray(body.scores)) return invalidGuidedInput()
    const { assessmentId } = await params
    return NextResponse.json({ data: await correctAssessment(assessmentId, body.reason, body.scores, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
