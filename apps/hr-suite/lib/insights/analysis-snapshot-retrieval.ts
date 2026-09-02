import 'server-only'

import type { Database } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { AnalysisEngineError } from './analysis-errors'
import type { DateOnly } from './analysis-spec-v2'
import type { SnapshotPopulationMode, SnapshotSource, SnapshotSourcePlacement, SnapshotSourceRow } from './analysis-snapshot'

const SNAPSHOT_PAGE_SIZE = 200 as const
export const ANALYSIS_SNAPSHOT_PAGE_SIZE = SNAPSHOT_PAGE_SIZE
type EmploymentRow = Database['public']['Tables']['employments']['Row']
type EmployeeRow = Database['public']['Tables']['employees']['Row']
type PlacementRow = Database['public']['Tables']['employee_organizations']['Row']
type SnapshotEmploymentRow = Pick<EmploymentRow, 'id' | 'tenant_id' | 'hr_group_id' | 'employee_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at' | 'is_primary' | 'employment_type'>
type SnapshotEmployeeRow = Pick<EmployeeRow, 'id' | 'tenant_id' | 'hr_group_id' | 'deleted_at'>
type SnapshotPlacementRow = Pick<PlacementRow, 'id' | 'tenant_id' | 'hr_group_id' | 'employee_id' | 'employment_id' | 'department_id' | 'job_id' | 'direct_manager_id' | 'effective_from' | 'effective_to'>
type AdminClient = ReturnType<typeof createAdminClient>

export interface LoadSnapshotSourceInput {
  readonly authContext: AuthContext
  readonly asOf: DateOnly
  readonly populationMode: SnapshotPopulationMode
}

function retrievalFailure(): never {
  throw new AnalysisEngineError('ANALYSIS_RETRIEVAL_INCOMPLETE', 500)
}

function scopeFailure(): never {
  throw new AnalysisEngineError('ANALYSIS_SCOPE_NOT_PROVABLE', 403)
}

function assertScoped(row: { readonly tenant_id: string; readonly hr_group_id: string }, context: AuthContext, hrGroupId: string): void {
  if (row.tenant_id !== context.tenantId || row.hr_group_id !== hrGroupId) retrievalFailure()
}

export async function collectCompleteKeysetPages<T extends { readonly id: string }>(
  expectedCount: number,
  readPage: (cursor: string | null, pageSize: number) => Promise<{ readonly rows: readonly T[]; readonly error: unknown | null }>,
): Promise<readonly T[]> {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) retrievalFailure()
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  while (rows.length < expectedCount) {
    const page = await readPage(cursor, SNAPSHOT_PAGE_SIZE)
    if (page.error || page.rows.length === 0 || page.rows.length > expectedCount - rows.length) retrievalFailure()
    for (const row of page.rows) {
      if (row.id.trim() === '' || seen.has(row.id) || (cursor !== null && row.id <= cursor)) retrievalFailure()
      seen.add(row.id)
      rows.push(row)
    }
    cursor = page.rows[page.rows.length - 1]?.id ?? null
    if (page.rows.length < SNAPSHOT_PAGE_SIZE && rows.length < expectedCount) retrievalFailure()
  }
  if (rows.length !== expectedCount) retrievalFailure()
  return rows
}

function placementFromRow(row: SnapshotPlacementRow, labels: { readonly departmentLabel: string | null; readonly jobLabel: string | null }): SnapshotSourcePlacement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    hrGroupId: row.hr_group_id,
    employeeId: row.employee_id,
    employmentId: row.employment_id,
    departmentId: row.department_id,
    jobId: row.job_id,
    directManagerId: row.direct_manager_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    departmentLabel: labels.departmentLabel,
    jobLabel: labels.jobLabel,
  }
}

async function loadManagerEmploymentScope(client: AdminClient, context: AuthContext, hrGroupId: string, asOf: string): Promise<ReadonlySet<string>> {
  const actorEmployeeId = context.employeeId
  if (!actorEmployeeId) scopeFailure()

  const { count, error: countError } = await client
    .from('employee_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('direct_manager_id', actorEmployeeId)
    .not('employment_id', 'is', null)
    .lte('effective_from', asOf)
    .or(`effective_to.is.null,effective_to.gte.${asOf}`)
  if (countError || count === null) scopeFailure()

  const rows = await collectCompleteKeysetPages(count, async (cursor, pageSize) => {
    const page = cursor
      ? await client
        .from('employee_organizations')
        .select('id,tenant_id,hr_group_id,employee_id,employment_id,department_id,job_id,direct_manager_id,effective_from,effective_to')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', hrGroupId)
        .eq('direct_manager_id', actorEmployeeId)
        .not('employment_id', 'is', null)
        .lte('effective_from', asOf)
        .or(`effective_to.is.null,effective_to.gte.${asOf}`)
        .gt('id', cursor)
        .order('id', { ascending: true })
        .limit(pageSize)
      : await client
        .from('employee_organizations')
        .select('id,tenant_id,hr_group_id,employee_id,employment_id,department_id,job_id,direct_manager_id,effective_from,effective_to')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', hrGroupId)
        .eq('direct_manager_id', actorEmployeeId)
        .not('employment_id', 'is', null)
        .lte('effective_from', asOf)
        .or(`effective_to.is.null,effective_to.gte.${asOf}`)
        .order('id', { ascending: true })
        .limit(pageSize)
    return { rows: (page.data ?? []) as readonly SnapshotPlacementRow[], error: page.error }
  })
  for (const row of rows) {
    assertScoped(row, context, hrGroupId)
    if (!row.employment_id || row.direct_manager_id !== actorEmployeeId) scopeFailure()
  }

  const employmentIds = new Set<string>()
  for (const row of rows) {
    if (employmentIds.has(row.employment_id as string)) scopeFailure()
    employmentIds.add(row.employment_id as string)
  }
  return employmentIds
}

async function loadCurrentLabels(client: AdminClient, context: AuthContext, hrGroupId: string, placements: readonly SnapshotPlacementRow[]): Promise<Map<string, { readonly departmentLabel: string | null; readonly jobLabel: string | null }>> {
  const departmentIds = [...new Set(placements.map((row) => row.department_id).filter((value): value is string => value !== null))]
  const jobIds = [...new Set(placements.map((row) => row.job_id).filter((value): value is string => value !== null))]
  const departmentLabels = new Map<string, string>()
  const jobLabels = new Map<string, string>()

  if (departmentIds.length > 0) {
    const { data, error } = await client.from('departments').select('id,tenant_id,hr_group_id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', departmentIds)
    if (error) retrievalFailure()
    for (const row of data ?? []) {
      assertScoped(row, context, hrGroupId)
      if (departmentLabels.has(row.id)) retrievalFailure()
      departmentLabels.set(row.id, row.name)
    }
  }

  if (jobIds.length > 0) {
    const { data: jobs, error: jobsError } = await client.from('jobs').select('id,tenant_id,hr_group_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', jobIds)
    if (jobsError) retrievalFailure()
    for (const row of jobs ?? []) assertScoped(row, context, hrGroupId)

    const today = new Date().toISOString().slice(0, 10)
    const { data: revisions, error: revisionsError } = await client
      .from('job_revisions')
      .select('id,job_id,tenant_id,hr_group_id,name,valid_from,valid_until')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('job_id', jobIds)
      .lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gt.${today}`)
      .order('valid_from', { ascending: false })
      .order('id', { ascending: false })
    if (revisionsError) retrievalFailure()
    for (const row of revisions ?? []) {
      assertScoped(row, context, hrGroupId)
      if (!jobLabels.has(row.job_id)) jobLabels.set(row.job_id, row.name)
    }
  }

  return new Map(placements.map((row) => [row.id, {
    departmentLabel: row.department_id === null ? null : departmentLabels.get(row.department_id) ?? null,
    jobLabel: row.job_id === null ? null : jobLabels.get(row.job_id) ?? null,
  }]))
}

async function loadPlacement(client: AdminClient, context: AuthContext, hrGroupId: string, row: SnapshotEmploymentRow, asOf: string, allowLegacy: boolean): Promise<SnapshotPlacementRow | null> {
  const { data, error } = await client
    .from('employee_organizations')
    .select('id,tenant_id,hr_group_id,employee_id,employment_id,department_id,job_id,direct_manager_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', row.employee_id)
    .eq('employment_id', row.id)
    .lte('effective_from', asOf)
    .or(`effective_to.is.null,effective_to.gte.${asOf}`)
    .order('effective_from', { ascending: false })
    .order('id', { ascending: false })
    .limit(2)
  if (error) retrievalFailure()
  if ((data ?? []).length > 1) throw new AnalysisEngineError('ANALYSIS_SNAPSHOT_AMBIGUOUS', 500)
  if ((data ?? []).length === 1) return data?.[0] ?? null
  if (!allowLegacy) return null

  const { data: legacy, error: legacyError } = await client
    .from('employee_organizations')
    .select('id,tenant_id,hr_group_id,employee_id,employment_id,department_id,job_id,direct_manager_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', row.employee_id)
    .is('employment_id', null)
    .lte('effective_from', asOf)
    .or(`effective_to.is.null,effective_to.gte.${asOf}`)
    .order('effective_from', { ascending: false })
    .order('id', { ascending: false })
    .limit(2)
  if (legacyError) retrievalFailure()
  if ((legacy ?? []).length > 1) throw new AnalysisEngineError('ANALYSIS_SNAPSHOT_AMBIGUOUS', 500)
  return legacy?.[0] ?? null
}

export async function loadSnapshotSource(input: LoadSnapshotSourceInput): Promise<SnapshotSource> {
  const { authContext, asOf, populationMode } = input
  const hrGroupId = authContext.hrGroupId
  if (!hrGroupId) throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
  const client = createAdminClient()
  const employmentScope = populationMode === 'DIRECT_REPORTS'
    ? await loadManagerEmploymentScope(client, authContext, hrGroupId, asOf)
    : null

  if (employmentScope && employmentScope.size === 0) {
    return { asOf, rows: [], expectedEmploymentCount: 0, retrievedEmploymentCount: 0, complete: true }
  }

  const { count, error: countError } = employmentScope
    ? await client
      .from('employments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', authContext.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('record_status', 'CONFIRMED')
      .is('deleted_at', null)
      .lte('starts_on', asOf)
      .or(`ends_on.is.null,ends_on.gte.${asOf}`)
      .in('id', [...employmentScope])
    : await client
      .from('employments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', authContext.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('record_status', 'CONFIRMED')
      .is('deleted_at', null)
      .lte('starts_on', asOf)
      .or(`ends_on.is.null,ends_on.gte.${asOf}`)
  if (countError || count === null) retrievalFailure()

  const rows = await collectCompleteKeysetPages(count, async (cursor, pageSize) => {
    const base = client
      .from('employments')
      .select('id,tenant_id,hr_group_id,employee_id,starts_on,ends_on,record_status,deleted_at,is_primary,employment_type')
      .eq('tenant_id', authContext.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('record_status', 'CONFIRMED')
      .is('deleted_at', null)
      .lte('starts_on', asOf)
      .or(`ends_on.is.null,ends_on.gte.${asOf}`)
    if (employmentScope) {
      const page = cursor
        ? await base.in('id', [...employmentScope]).gt('id', cursor).order('id', { ascending: true }).limit(pageSize)
        : await base.in('id', [...employmentScope]).order('id', { ascending: true }).limit(pageSize)
      return { rows: (page.data ?? []) as readonly SnapshotEmploymentRow[], error: page.error }
    }
    const page = cursor
      ? await base.gt('id', cursor).order('id', { ascending: true }).limit(pageSize)
      : await base.order('id', { ascending: true }).limit(pageSize)
    return { rows: (page.data ?? []) as readonly SnapshotEmploymentRow[], error: page.error }
  })
  for (const row of rows) assertScoped(row, authContext, hrGroupId)

  const employeeIds = [...new Set(rows.map((row) => row.employee_id))]
  const { data: employees, error: employeesError } = await client
    .from('employees')
    .select('id,tenant_id,hr_group_id,deleted_at')
    .eq('tenant_id', authContext.tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('id', employeeIds)
  if (employeesError || (employees ?? []).length !== employeeIds.length) retrievalFailure()
  const employeeById = new Map((employees ?? []).map((employee: SnapshotEmployeeRow) => {
    assertScoped(employee, authContext, hrGroupId)
    return [employee.id, employee]
  }))

  const qualifyingCountByEmployee = new Map<string, number>()
  for (const row of rows) qualifyingCountByEmployee.set(row.employee_id, (qualifyingCountByEmployee.get(row.employee_id) ?? 0) + 1)
  const placements: Array<{ readonly employment: SnapshotEmploymentRow; readonly placement: SnapshotPlacementRow | null }> = []
  for (const row of rows) {
    const placement = await loadPlacement(client, authContext, hrGroupId, row, asOf, populationMode === 'HR_GROUP' && qualifyingCountByEmployee.get(row.employee_id) === 1)
    if (placement) assertScoped(placement, authContext, hrGroupId)
    placements.push({ employment: row, placement })
  }
  const labels = await loadCurrentLabels(client, authContext, hrGroupId, placements.flatMap((item) => item.placement ? [item.placement] : []))

  const sourceRows: SnapshotSourceRow[] = placements.map(({ employment, placement }) => {
    const label = placement ? labels.get(placement.id) : undefined
    const employee = employeeById.get(employment.employee_id)
    if (!employee) retrievalFailure()
    return {
      employmentId: employment.id,
      employeeId: employment.employee_id,
      tenantId: employment.tenant_id,
      hrGroupId: employment.hr_group_id,
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
      employeeDeletedAt: employee.deleted_at,
      isPrimary: employment.is_primary,
      employmentType: employment.employment_type,
      placement: placement ? placementFromRow(placement, label ?? { departmentLabel: null, jobLabel: null }) : null,
    }
  })
  return { asOf, rows: sourceRows, expectedEmploymentCount: count, retrievedEmploymentCount: sourceRows.length, complete: true }
}
