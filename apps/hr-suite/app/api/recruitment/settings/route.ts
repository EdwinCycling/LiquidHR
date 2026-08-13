import { NextResponse } from 'next/server'
import { getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { getRecruitmentSettings, listRecruitmentPipelineStages, updateRecruitmentSettings } from '@/lib/recruitment/guided-service'
import { guidedErrorResponse, invalidGuidedInput } from '../guided-route'

export async function GET(): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const { context, supabase } = await getRequestAuthorizationContext()
    await requirePermission('recruitment-settings:manage')
    const [settings, pipeline] = await Promise.all([getRecruitmentSettings(context, supabase), listRecruitmentPipelineStages(context, supabase)])
    return NextResponse.json({ data: { settings, pipeline } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return guidedErrorResponse(error) }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireTenantModule('RECRUITMENT')
    const context = await requirePermission('recruitment-settings:manage')
    const body = await request.json().catch(() => null)
    if (typeof body !== 'object' || body === null || typeof body.retentionDays !== 'number' || typeof body.expectedVersion !== 'number' || typeof body.publicBranding !== 'object' || body.publicBranding === null || typeof body.publicationDefaults !== 'object' || body.publicationDefaults === null) return invalidGuidedInput()
    return NextResponse.json({ data: await updateRecruitmentSettings(context, { retentionDays: body.retentionDays, publicBranding: body.publicBranding as Record<string, unknown>, publicationDefaults: body.publicationDefaults as Record<string, unknown>, expectedVersion: body.expectedVersion }, await createClient()) })
  } catch (error) { return guidedErrorResponse(error) }
}
