import type { Database } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'

export class TalentTeamError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentTeamError'
  }
}

type CapabilityRecordRow = Database['public']['Tables']['talent_employee_capability_records']['Row']

export type TalentTeamMatrixCapability = Pick<CapabilityRecordRow, 'id' | 'capability_id' | 'status' | 'source_type' | 'valid_from' | 'valid_until' | 'certificate_status' | 'evidence_status' | 'certificate_code'> & {
  capabilityName: string
  capabilityCode: string
  capabilityType: string
}

export type TalentTeamMatrixRow = {
  employeeId: string
  employeeNumber: string
  employeeLabel: string
  jobTitle: string | null
  departmentId: string
  capabilities: TalentTeamMatrixCapability[]
}

export type TalentTeamMatrix = {
  rows: TalentTeamMatrixRow[]
  scopeCount: number
  aggregatePolicy: 'DISABLED'
  aggregateMinimumGroupSize: 5
}

type Placement = Pick<Database['public']['Tables']['employee_organizations']['Row'], 'employee_id' | 'job_title' | 'department_id' | 'job_id' | 'effective_from'>

function label(firstName: string, birthName: string, employeeNumber: string): string {
  return [firstName, birthName].filter((value) => value.trim().length > 0).join(' ').trim() || employeeNumber
}

export async function listTalentTeamMatrix(): Promise<TalentTeamMatrix> {
  const context = await requirePermission('talent-team:read')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const canReadTenant = context.permissions.includes('talent:manage')
  let placementQuery = supabase
    .from('employee_organizations')
    .select('employee_id,job_title,department_id,job_id,effective_from')
    .eq('tenant_id', context.tenantId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(5000)
  if (!canReadTenant) {
    if (!context.employeeId) throw new TalentTeamError('EMPLOYEE_CONTEXT_REQUIRED', 403)
    placementQuery = placementQuery.eq('direct_manager_id', context.employeeId)
  }
  const { data: placementRows, error: placementError } = await placementQuery
  if (placementError) throw new TalentTeamError('TALENT_TEAM_SCOPE_READ_FAILED')
  const placements = new Map<string, Placement>()
  for (const placement of placementRows ?? []) {
    if (!placements.has(placement.employee_id)) placements.set(placement.employee_id, placement)
  }
  const employeeIds = [...placements.keys()]
  if (employeeIds.length === 0) return { rows: [], scopeCount: 0, aggregatePolicy: 'DISABLED', aggregateMinimumGroupSize: 5 }

  const visibleStatuses = canReadTenant ? ['DRAFT', 'RELEASED', 'EXPIRED'] : ['RELEASED', 'EXPIRED']
  const [employeesResult, recordsResult] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null),
    supabase.from('talent_employee_capability_records').select('id,employee_id,capability_id,status,source_type,valid_from,valid_until,certificate_status,evidence_status,certificate_code').eq('tenant_id', context.tenantId).in('employee_id', employeeIds).in('status', visibleStatuses).order('valid_from', { ascending: false }).limit(10000),
  ])
  if (employeesResult.error || recordsResult.error) throw new TalentTeamError('TALENT_TEAM_READ_FAILED')
  const capabilityIds = [...new Set((recordsResult.data ?? []).map((record) => record.capability_id))]
  const { data: capabilities, error: capabilitiesError } = capabilityIds.length > 0
    ? await supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds)
    : { data: [], error: null }
  if (capabilitiesError) throw new TalentTeamError('TALENT_TEAM_CAPABILITY_READ_FAILED')
  const capabilityById = new Map((capabilities ?? []).map((capability) => [capability.id, capability]))
  const recordsByEmployee = new Map<string, TalentTeamMatrixCapability[]>()
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
      capabilities: recordsByEmployee.get(employeeId) ?? [],
    }]
  })
  return { rows, scopeCount: rows.length, aggregatePolicy: 'DISABLED', aggregateMinimumGroupSize: 5 }
}
