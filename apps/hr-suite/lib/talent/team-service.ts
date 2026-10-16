import type { Database } from '@scope/db'
import { requirePermission, requirePermissionInContext, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import type { TalentTeamMatrixFilters } from './team-schemas'
import { filterTalentTeamMatrixRows, type TalentTeamMatrix, type TalentTeamMatrixCapability } from './team-model'

export type { TalentTeamMatrix, TalentTeamMatrixCapability, TalentTeamMatrixRow } from './team-model'

export class TalentTeamError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentTeamError'
  }
}

type Placement = Pick<Database['public']['Tables']['employee_organizations']['Row'], 'employee_id' | 'job_title' | 'department_id' | 'job_id' | 'effective_from'>
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface TalentTeamMatrixDependencies {
  readonly context: AuthContext
  readonly supabase: SupabaseServerClient
}

type TalentTeamMatrixOptions = { includeCapabilities?: boolean }

function label(firstName: string, birthName: string, employeeNumber: string): string {
  return [firstName, birthName].filter((value) => value.trim().length > 0).join(' ').trim() || employeeNumber
}

function emptyTalentTeamMatrix(scopeType: 'TEAM' | 'TENANT', sourceTruncated = false): TalentTeamMatrix {
  return { rows: [], sourceTruncated, scopeCount: 0, scopeType, aggregatePolicy: 'DISABLED', aggregateMinimumGroupSize: 5, aggregateDisabled: true }
}

async function readTalentTeamMatrixForPlacements(
  context: AuthContext,
  supabase: SupabaseServerClient,
  filters: TalentTeamMatrixFilters,
  placements: Map<string, Placement>,
  scopeType: 'TEAM' | 'TENANT',
  placementSourceTruncated: boolean,
  includeCapabilities: boolean,
): Promise<TalentTeamMatrix> {
  const employeeIds = [...placements.keys()]
  if (employeeIds.length === 0) return emptyTalentTeamMatrix(scopeType, placementSourceTruncated)

  const departmentIds = [...new Set([...placements.values()].flatMap((placement) => placement.department_id ? [placement.department_id] : []))]
  const departmentsQuery = departmentIds.length > 0
    ? supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).in('id', departmentIds)
    : Promise.resolve({ data: [] as Array<Pick<Database['public']['Tables']['departments']['Row'], 'id' | 'name'>>, error: null })
  const [employeesResult, departmentsResult] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null),
    departmentsQuery,
  ])
  if (employeesResult.error) throw new TalentTeamError('TALENT_TEAM_READ_FAILED')
  if (departmentsResult.error) throw new TalentTeamError('TALENT_TEAM_DEPARTMENT_READ_FAILED')
  const departmentById = new Map((departmentsResult.data ?? []).map((department) => [department.id, department.name]))
  const recordsByEmployee = new Map<string, TalentTeamMatrixCapability[]>()
  let capabilitySourceTruncated = false
  if (includeCapabilities) {
    const visibleStatuses = scopeType === 'TENANT' ? ['DRAFT', 'RELEASED', 'EXPIRED'] : ['RELEASED', 'EXPIRED']
    const recordsResult = await supabase.from('talent_employee_capability_records').select('id,employee_id,capability_id,status,source_type,valid_from,valid_until,certificate_status,evidence_status,certificate_code', { count: 'exact' }).eq('tenant_id', context.tenantId).in('employee_id', employeeIds).in('status', visibleStatuses).order('valid_from', { ascending: false }).limit(10000)
    if (recordsResult.error || recordsResult.count === null) throw new TalentTeamError('TALENT_TEAM_READ_FAILED')
    capabilitySourceTruncated = recordsResult.count > (recordsResult.data?.length ?? 0)
    const capabilityIds = [...new Set((recordsResult.data ?? []).map((record) => record.capability_id))]
    const { data: capabilities, error: capabilitiesError } = capabilityIds.length > 0
      ? await supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds)
      : { data: [], error: null }
    if (capabilitiesError) throw new TalentTeamError('TALENT_TEAM_CAPABILITY_READ_FAILED')
    const capabilityById = new Map((capabilities ?? []).map((capability) => [capability.id, capability]))
    for (const record of recordsResult.data ?? []) {
      const capability = capabilityById.get(record.capability_id)
      if (!capability) continue
      const list = recordsByEmployee.get(record.employee_id) ?? []
      list.push({
        id: record.id,
        capability_id: record.capability_id,
        status: record.status,
        source_type: record.source_type,
        valid_from: record.valid_from,
        valid_until: record.valid_until,
        certificate_status: record.certificate_status,
        evidence_status: record.evidence_status,
        certificate_code: record.certificate_code,
        capabilityName: capability.name,
        capabilityCode: capability.code,
        capabilityType: capability.capability_type,
      })
      recordsByEmployee.set(record.employee_id, list)
    }
  }
  const employeeById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee]))
  const rows = employeeIds.flatMap((employeeId) => {
    const employee = employeeById.get(employeeId)
    const placement = placements.get(employeeId)
    if (!employee || !placement) return []
    return [{
      employeeId,
      employeeNumber: employee.employee_number,
      employeeLabel: label(employee.first_name, employee.birth_name, employee.employee_number),
      jobTitle: placement.job_title,
      departmentId: placement.department_id,
      departmentName: placement.department_id ? departmentById.get(placement.department_id) ?? null : null,
      capabilities: recordsByEmployee.get(employeeId) ?? [],
    }]
  })
  return { rows: filterTalentTeamMatrixRows(rows, filters), sourceTruncated: placementSourceTruncated || capabilitySourceTruncated, scopeCount: rows.length, scopeType, aggregatePolicy: 'DISABLED', aggregateMinimumGroupSize: 5, aggregateDisabled: true }
}

function assertDirectManagerContext(context: AuthContext): void {
  if (!context.activeRoles.includes('DIRECT_MANAGER') || !context.employeeId || !context.administrationId || !context.hrGroupId) {
    throw new TalentTeamError('TALENT_TEAM_MANAGER_SCOPE_REQUIRED', 403)
  }
}

/** Always resolves this matrix from the current manager's direct team, even when the actor also has HR permissions. */
export async function listManagerTalentTeamMatrix(
  filters: TalentTeamMatrixFilters = {},
  dependencies?: TalentTeamMatrixDependencies,
  options: TalentTeamMatrixOptions = {},
): Promise<TalentTeamMatrix> {
  const supabase = dependencies?.supabase ?? await createClient()
  const context = dependencies
    ? await requirePermissionInContext(supabase, dependencies.context, 'talent-team:read')
    : await requirePermission('talent-team:read')
  await requireTenantModule('TALENT', dependencies ? { auth: context, supabase } : undefined)
  assertDirectManagerContext(context)

  const scope = await listDirectTeamEmployeeScope(context, supabase, 5_000)
  const placements = new Map<string, Placement>()
  for (const placement of scope.members) {
    if (!placements.has(placement.employee_id)) placements.set(placement.employee_id, placement)
  }
  return readTalentTeamMatrixForPlacements(context, supabase, filters, placements, 'TEAM', scope.sourceTruncated, options.includeCapabilities !== false)
}

export async function listTalentTeamMatrix(filters: TalentTeamMatrixFilters = {}, options: TalentTeamMatrixOptions = {}): Promise<TalentTeamMatrix> {
  const context = await requirePermission('talent-team:read')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const canReadTenant = context.permissions.includes('talent:manage')
  if (!canReadTenant) return listManagerTalentTeamMatrix(filters, { context, supabase }, options)

  const today = new Date().toISOString().slice(0, 10)
  const { data: placementRows, error: placementError, count: placementCount } = await supabase
    .from('employee_organizations')
    .select('employee_id,job_title,department_id,job_id,effective_from', { count: 'exact' })
    .eq('tenant_id', context.tenantId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(5_000)
  if (placementError || placementCount === null) throw new TalentTeamError('TALENT_TEAM_SCOPE_READ_FAILED')

  const placements = new Map<string, Placement>()
  for (const placement of placementRows ?? []) {
    if (!placements.has(placement.employee_id)) placements.set(placement.employee_id, placement)
  }
  return readTalentTeamMatrixForPlacements(
    context,
    supabase,
    filters,
    placements,
    'TENANT',
    placementCount > (placementRows?.length ?? 0),
    options.includeCapabilities !== false,
  )
}
