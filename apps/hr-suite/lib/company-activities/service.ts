import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { CompanyActivityInput } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface CompanyActivityItem {
  id: string
  name: string
  activity_date: string
  is_active: boolean
}

export interface CalendarHeaderItem {
  name: string
  date: string
}

export interface UpcomingCalendarItems {
  holiday: CalendarHeaderItem | null
  companyActivity: CalendarHeaderItem | null
}

export class CompanyActivityError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'CompanyActivityError'
  }
}

function databaseError(message: string): never {
  const code = message.match(/COMPANY_ACTIVITY_[A-Z_]+/)?.[0] ?? 'COMPANY_ACTIVITY_OPERATION_FAILED'
  throw new CompanyActivityError(code, code.includes('NOT_FOUND') ? 404 : code.includes('FORBIDDEN') ? 403 : 400)
}

export async function listCompanyActivities(year: number): Promise<CompanyActivityItem[]> {
  const auth = await requirePermission('holidays:read')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_activities')
    .select('id,name,activity_date,is_active')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', hrGroupId)
    .gte('activity_date', `${year}-01-01`)
    .lt('activity_date', `${year + 1}-01-01`)
    .order('activity_date')
    .order('name')
    .limit(500)
  if (error) {
    // Tijdens een gefaseerde rollout mag een nog niet toegepaste migratie de bestaande feestdagpagina niet blokkeren.
    if (error.message.includes('company_activities') && (error.message.includes('does not exist') || error.message.includes('schema cache') || error.message.includes('Could not find the table'))) return []
    databaseError(error.message)
  }
  return data ?? []
}

export async function createCompanyActivity(input: CompanyActivityInput): Promise<string> {
  const auth = await requirePermission('holidays:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_activities').insert({
    tenant_id: auth.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    name: input.name,
    activity_date: input.date,
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'COMPANY_ACTIVITY_OPERATION_FAILED')
  return data.id
}

export async function getUpcomingCalendarItems(auth: AuthContext, supabase: SupabaseServerClient): Promise<UpcomingCalendarItems> {
  if (!auth.hrGroupId) return { holiday: null, companyActivity: null }
  const today = new Date().toISOString().slice(0, 10)
  const [holidayResult, activityResult] = await Promise.all([
    supabase.from('holidays').select('holiday_date,display_name,provider_name').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).eq('is_active', true).gte('holiday_date', today).order('holiday_date').limit(1).maybeSingle(),
    supabase.from('company_activities').select('activity_date,name').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).eq('is_active', true).gte('activity_date', today).order('activity_date').order('name').limit(1).maybeSingle(),
  ])
  return {
    holiday: holidayResult.error || !holidayResult.data ? null : { date: holidayResult.data.holiday_date, name: holidayResult.data.display_name ?? holidayResult.data.provider_name },
    companyActivity: activityResult.error || !activityResult.data ? null : { date: activityResult.data.activity_date, name: activityResult.data.name },
  }
}

export function companyActivityErrorResponse(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof CompanyActivityError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'COMPANY_ACTIVITY_OPERATION_FAILED' }, { status: 500 })
}
