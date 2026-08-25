import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createGuidedInterview, listGuidedInterviews } from '@/lib/recruitment/guided-service'
import { interviewInputSchema } from '@/lib/recruitment/interview-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const { context, supabase } = await getRequestAuthorizationContext()
    await requireAnyPermission(['recruitment-candidate:read', 'recruitment-assessment:read', 'recruitment-participation:read'])
    const applicationId = new URL(request.url).searchParams.get('applicationId')
    if (!applicationId) return invalidGuidedInput()
    return NextResponse.json({ data: await listGuidedInterviews(context, applicationId, supabase) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:write')
    const body = await request.json().catch(() => null)
    const parsed = interviewInputSchema.safeParse(body)
    if (!parsed.success) return invalidGuidedInput('RECRUITMENT_INTERVIEW_INPUT_INVALID')
    return NextResponse.json({ data: await createGuidedInterview(parsed.data, await createClient()) }, { status: 201 })
  } catch (error) { return guidedErrorResponse(error) }
}
