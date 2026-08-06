import type { Tables } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LeaveEmployment = Pick<
  Tables<'employments'>,
  'id' | 'employee_id' | 'employment_number' | 'tenant_id' | 'hr_group_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status' | 'is_primary'
> & { deleted_at: string | null }

export type LeaveEmploymentOption = {
  id: string
  employmentNumber: string | null
  startsOn: string
  endsOn: string | null
  administrationName: string | null
  departmentName: string | null
  functionName: string | null
}

export type LeaveEmploymentSelection = {
  employment: LeaveEmployment | null
  options: LeaveEmploymentOption[]
}

function activeOn(row: Pick<LeaveEmployment, 'starts_on' | 'ends_on' | 'record_status'>, date: string): boolean {
  return row.record_status === 'CONFIRMED' && row.starts_on <= date && (row.ends_on === null || row.ends_on >= date)
}

async function enrichOptions(supabase: SupabaseServerClient, rows: LeaveEmployment[]): Promise<LeaveEmploymentOption[]> {
  if (rows.length === 0) return []
  const tenantId = rows[0].tenant_id
  const groupId = rows[0].hr_group_id
  const employmentIds = rows.map((row) => row.id)
  const administrationIds = [...new Set(rows.map((row) => row.administration_id))]
  const [administrations, placements, departments, jobs] = await Promise.all([
    supabase.from('administrations').select('id, name').eq('tenant_id', tenantId).in('id', administrationIds).limit(100),
    supabase.from('employee_organizations').select('employment_id, department_id, job_id, job_title').eq('tenant_id', tenantId).eq('hr_group_id', groupId).in('employment_id', employmentIds).lte('effective_from', new Date().toISOString().slice(0, 10)).or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().slice(0, 10)}`).order('effective_from', { ascending: false }).limit(500),
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId).eq('hr_group_id', groupId).limit(500),
    supabase.from('jobs').select('id, code').eq('tenant_id', tenantId).eq('hr_group_id', groupId).limit(500),
  ])
  if (administrations.error) throw administrations.error
  if (placements.error) throw placements.error
  if (departments.error) throw departments.error
  if (jobs.error) throw jobs.error
  const administrationNames = new Map(administrations.data.map((row) => [row.id, row.name]))
  const departmentNames = new Map(departments.data.map((row) => [row.id, row.name]))
  const jobCodes = new Map(jobs.data.map((row) => [row.id, row.code]))
  const placementByEmployment = new Map<string, (typeof placements.data)[number]>()
  for (const placement of placements.data) if (placement.employment_id && !placementByEmployment.has(placement.employment_id)) placementByEmployment.set(placement.employment_id, placement)
  return rows.map((row) => {
    const placement = placementByEmployment.get(row.id)
    return {
      id: row.id,
      employmentNumber: row.employment_number,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      administrationName: administrationNames.get(row.administration_id) ?? null,
      departmentName: placement ? departmentNames.get(placement.department_id) ?? null : null,
      functionName: placement?.job_title ?? (placement?.job_id ? jobCodes.get(placement.job_id) ?? null : null),
    }
  })
}

export function selectEmploymentCandidate<T extends { id: string }>(candidates: readonly T[], preferredIds: ReadonlySet<string>): T | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0] ?? null
  const preferredCandidates = candidates.filter((candidate) => preferredIds.has(candidate.id))
  return preferredCandidates.length === 1 ? preferredCandidates[0] ?? null : null
}

async function managerScopedEmploymentIds(supabase: SupabaseServerClient, context: AuthContext, employeeId: string, date: string): Promise<Set<string>> {
  if (!context.employeeId || context.employeeId === employeeId || !context.hrGroupId) return new Set()
  const [placements, management] = await Promise.all([
    supabase.from('employee_organizations').select('employment_id, department_id, direct_manager_id').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('employee_id', employeeId).lte('effective_from', date).or(`effective_to.is.null,effective_to.gte.${date}`).limit(100),
    supabase.from('department_management').select('department_id').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('employee_id', context.employeeId).lte('effective_from', date).or(`effective_to.is.null,effective_to.gte.${date}`).limit(100),
  ])
  if (placements.error) throw placements.error
  if (management.error) throw management.error
  const departmentIds = new Set(management.data.map((row) => row.department_id))
  return new Set(placements.data.filter((row) => row.employment_id && (row.direct_manager_id === context.employeeId || departmentIds.has(row.department_id))).map((row) => row.employment_id as string))
}

export async function resolveLeaveEmployment(
  supabase: SupabaseServerClient,
  context: AuthContext,
  employeeId: string,
  employmentId: string | undefined,
  asOfDate: string,
): Promise<LeaveEmploymentSelection> {
  if (!context.hrGroupId) return { employment: null, options: [] }
  let query = supabase
    .from('employments')
    .select('id, employee_id, employment_number, tenant_id, hr_group_id, administration_id, starts_on, ends_on, record_status, is_primary, deleted_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('employee_id', employeeId)
    .eq('record_status', 'CONFIRMED')
    .is('deleted_at', null)
  if (employmentId) query = query.eq('id', employmentId)
  const result = await query.order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(100)
  if (result.error) throw result.error
  const activeRows = result.data.filter((row) => activeOn(row, asOfDate))
  const options = await enrichOptions(supabase, activeRows)
  if (activeRows.length === 0) return { employment: null, options }
  if (employmentId) return { employment: activeRows[0], options }
  if (activeRows.length === 1) return { employment: activeRows[0], options }
  const managerIds = await managerScopedEmploymentIds(supabase, context, employeeId, asOfDate)
  const selectedByManager = selectEmploymentCandidate(activeRows, managerIds)
  if (selectedByManager) return { employment: selectedByManager, options: await enrichOptions(supabase, [selectedByManager]) }
  return { employment: null, options }
}
