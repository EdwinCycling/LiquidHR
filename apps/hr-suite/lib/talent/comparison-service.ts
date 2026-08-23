import type { Database } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { TalentComparisonListQuery } from './comparison-schemas'

export class TalentComparisonError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentComparisonError'
  }
}

type ProfileRow = Database['public']['Views']['talent_job_profile_readmodel']['Row']
type RequirementRow = Database['public']['Tables']['job_profile_capability_requirements']['Row']
type RecordRow = Database['public']['Tables']['talent_employee_capability_records']['Row']
type LevelRow = Database['public']['Tables']['talent_levels']['Row']

export type TalentComparisonProfileOption = {
  profileVersionId: string
  jobId: string
  jobCode: string
  jobGroupId: string | null
  jobGroupName: string | null
  profileVersion: number
}

export type TalentComparisonEmployeeOption = {
  employeeId: string
  employeeNumber: string
  employeeLabel: string
  jobId: string | null
  jobTitle: string | null
}

export type TalentComparisonOutcome = 'MATCH' | 'GAP' | 'MISSING_EVIDENCE' | 'UNKNOWN'

export type TalentComparisonRequirement = {
  requirementId: string
  capabilityId: string
  capabilityCode: string
  capabilityName: string
  capabilityType: string
  requirementType: string
  targetLevelCode: string | null
  currentLevelCode: string | null
  languageLevel: string | null
  currentLanguageLevel: string | null
  rationale: string | null
  outcome: TalentComparisonOutcome
  sourceType: string | null
  validFrom: string | null
  validUntil: string | null
  sourceRecordId: string | null
}

export type TalentComparisonResult = {
  employee: TalentComparisonEmployeeOption
  profile: TalentComparisonProfileOption
  requirements: TalentComparisonRequirement[]
  sourceVersion: number
}

export type TalentComparisonWorkspace = {
  asOf: string
  profiles: TalentComparisonProfileOption[]
  employees: TalentComparisonEmployeeOption[]
  selectedEmployeeId: string | null
  selectedProfileVersionId: string | null
  comparison: TalentComparisonResult | null
}

type Placement = Pick<Database['public']['Tables']['employee_organizations']['Row'], 'employee_id' | 'job_id' | 'job_title' | 'effective_from'>
type Employee = Pick<Database['public']['Tables']['employees']['Row'], 'id' | 'employee_number' | 'first_name' | 'birth_name'>
type Capability = Pick<Database['public']['Tables']['talent_capabilities']['Row'], 'id' | 'code' | 'name' | 'capability_type'>

function employeeLabel(employee: Employee): string {
  return [employee.first_name, employee.birth_name].filter((value) => value.trim().length > 0).join(' ').trim() || employee.employee_number
}

function isCurrent(validFrom: string, validUntil: string | null, today: string): boolean {
  return validFrom <= today && (validUntil === null || validUntil > today)
}

function levelRank(levels: LevelRow[], id: string | null): number | null {
  if (!id) return null
  const level = levels.find((item) => item.id === id)
  return level?.sort_order ?? null
}

function levelCode(levels: LevelRow[], id: string | null): string | null {
  if (!id) return null
  return levels.find((item) => item.id === id)?.code ?? null
}

function languageRank(value: string | null): number | null {
  if (!value) return null
  const ranks: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, NATIVE: 7 }
  return ranks[value.toUpperCase()] ?? null
}

function recordPriority(record: RecordRow, today: string): number {
  if (record.status === 'RELEASED' && isCurrent(record.valid_from, record.valid_until, today)) return 3
  if (record.status === 'DRAFT' && isCurrent(record.valid_from, record.valid_until, today)) return 2
  return 1
}

function calculateOutcome(
  requirement: RequirementRow,
  capability: Capability | undefined,
  record: RecordRow | undefined,
  levels: LevelRow[],
  today: string,
): TalentComparisonOutcome {
  if (!capability || !record) return 'GAP'
  if (record.status !== 'RELEASED' || !isCurrent(record.valid_from, record.valid_until, today)) return 'UNKNOWN'
  if (capability.capability_type === 'CERTIFICATE' && record.evidence_status !== 'VERIFIED') return 'MISSING_EVIDENCE'
  const requiredLevel = levelRank(levels, requirement.target_level_id)
  if (requiredLevel !== null) {
    const actualLevel = levelRank(levels, record.talent_level_id)
    if (actualLevel === null) return 'GAP'
    if (actualLevel < requiredLevel) return 'GAP'
  }
  if (requirement.language_level) {
    const actualLanguageLevel = languageRank(record.language_level)
    const requiredLanguageLevel = languageRank(requirement.language_level)
    if (actualLanguageLevel === null || requiredLanguageLevel === null) return 'UNKNOWN'
    if (actualLanguageLevel < requiredLanguageLevel) return 'GAP'
  }
  return 'MATCH'
}

export async function listTalentComparisonWorkspace(query: TalentComparisonListQuery = {}): Promise<TalentComparisonWorkspace> {
  const context = await requirePermission('talent-comparison:read')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const canReadTenant = context.permissions.includes('talent:manage')

  let placementQuery = supabase
    .from('employee_organizations')
    .select('employee_id,job_id,job_title,effective_from')
    .eq('tenant_id', context.tenantId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gt.${today}`)
    .order('effective_from', { ascending: false })
    .limit(5000)
  if (!canReadTenant) {
    if (!context.employeeId) throw new TalentComparisonError('EMPLOYEE_CONTEXT_REQUIRED', 403)
    placementQuery = placementQuery.eq('direct_manager_id', context.employeeId)
  }

  const [profilesResult, placementsResult] = await Promise.all([
    supabase.from('talent_job_profile_readmodel').select('*').eq('tenant_id', context.tenantId).eq('job_is_active', true).eq('status', 'ACTIVE').not('profile_version_id', 'is', null).order('job_code').limit(500),
    placementQuery,
  ])
  if (profilesResult.error || placementsResult.error) throw new TalentComparisonError('TALENT_COMPARISON_READ_FAILED')

  const profiles = (profilesResult.data ?? []).filter((profile): profile is ProfileRow & { profile_version_id: string; job_id: string; job_code: string } => Boolean(profile.profile_version_id && profile.job_id && profile.job_code && (!profile.valid_from || profile.valid_from <= today) && (!profile.valid_until || profile.valid_until > today))).map((profile) => ({
    profileVersionId: profile.profile_version_id,
    jobId: profile.job_id,
    jobCode: profile.job_code,
    jobGroupId: profile.job_group_id,
    jobGroupName: profile.job_group_name,
    profileVersion: profile.version_number ?? 0,
  }))
  const placementByEmployee = new Map<string, Placement>()
  for (const placement of placementsResult.data ?? []) {
    if (!placementByEmployee.has(placement.employee_id)) placementByEmployee.set(placement.employee_id, placement)
  }
  const employeeIds = [...placementByEmployee.keys()]
  const employeesResult = employeeIds.length > 0
    ? await supabase.from('employees').select('id,employee_number,first_name,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).order('employee_number').limit(5000)
    : { data: [], error: null }
  if (employeesResult.error) throw new TalentComparisonError('TALENT_COMPARISON_EMPLOYEE_READ_FAILED')
  const employees = (employeesResult.data ?? []).map((employee) => {
    const placement = placementByEmployee.get(employee.id)
    return { employeeId: employee.id, employeeNumber: employee.employee_number, employeeLabel: employeeLabel(employee), jobId: placement?.job_id ?? null, jobTitle: placement?.job_title ?? null }
  })

  const selectedEmployeeId = query.employeeId && employees.some((employee) => employee.employeeId === query.employeeId) ? query.employeeId : null
  const selectedProfileVersionId = query.profileVersionId && profiles.some((profile) => profile.profileVersionId === query.profileVersionId) ? query.profileVersionId : null
  if (!selectedEmployeeId || !selectedProfileVersionId) return { asOf: today, profiles, employees, selectedEmployeeId, selectedProfileVersionId, comparison: null }

  const selectedProfile = profiles.find((profile) => profile.profileVersionId === selectedProfileVersionId)
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId)
  if (!selectedProfile || !selectedEmployee) throw new TalentComparisonError('TALENT_COMPARISON_SELECTION_INVALID', 400)

  const requirementsResult = await supabase.from('job_profile_capability_requirements').select('*').eq('tenant_id', context.tenantId).eq('profile_version_id', selectedProfileVersionId).order('sort_order').limit(500)
  if (requirementsResult.error) throw new TalentComparisonError('TALENT_COMPARISON_REQUIREMENTS_READ_FAILED')
  const capabilityIds = [...new Set((requirementsResult.data ?? []).map((requirement) => requirement.capability_id))]
  const [capabilitiesResult, levelsResult, recordsResult] = await Promise.all([
    capabilityIds.length > 0 ? supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('talent_levels').select('*').eq('tenant_id', context.tenantId).order('sort_order').limit(100),
    capabilityIds.length > 0 ? supabase.from('talent_employee_capability_records').select('*').eq('tenant_id', context.tenantId).eq('employee_id', selectedEmployeeId).in('capability_id', capabilityIds).in('status', ['DRAFT', 'RELEASED', 'EXPIRED']).order('valid_from', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
  ])
  if (capabilitiesResult.error || levelsResult.error || recordsResult.error) throw new TalentComparisonError('TALENT_COMPARISON_DATA_READ_FAILED')
  const capabilityById = new Map((capabilitiesResult.data ?? []).map((capability) => [capability.id, capability]))
  const levelRows = levelsResult.data ?? []
  const recordByCapability = new Map<string, RecordRow>()
  for (const record of recordsResult.data ?? []) {
    const current = recordByCapability.get(record.capability_id)
    if (!current || recordPriority(record, today) > recordPriority(current, today)) recordByCapability.set(record.capability_id, record)
  }
  const requirements = (requirementsResult.data ?? []).map((requirement) => {
    const capability = capabilityById.get(requirement.capability_id)
    const record = recordByCapability.get(requirement.capability_id)
    const isReleasedCurrent = Boolean(record && record.status === 'RELEASED' && isCurrent(record.valid_from, record.valid_until, today))
    return {
      requirementId: requirement.id,
      capabilityId: requirement.capability_id,
      capabilityCode: capability?.code ?? requirement.capability_id,
      capabilityName: capability?.name ?? requirement.capability_id,
      capabilityType: capability?.capability_type ?? 'UNKNOWN',
      requirementType: requirement.requirement_type,
      targetLevelCode: levelCode(levelRows, requirement.target_level_id),
      currentLevelCode: isReleasedCurrent ? levelCode(levelRows, record?.talent_level_id ?? null) : null,
      languageLevel: requirement.language_level,
      currentLanguageLevel: isReleasedCurrent ? record?.language_level ?? null : null,
      rationale: requirement.rationale,
      outcome: calculateOutcome(requirement, capability, record, levelRows, today),
      sourceType: isReleasedCurrent ? record?.source_type ?? null : null,
      validFrom: isReleasedCurrent ? record?.valid_from ?? null : null,
      validUntil: isReleasedCurrent ? record?.valid_until ?? null : null,
      sourceRecordId: isReleasedCurrent ? record?.id ?? null : null,
    }
  })
  return { asOf: today, profiles, employees, selectedEmployeeId, selectedProfileVersionId, comparison: { employee: selectedEmployee, profile: selectedProfile, requirements, sourceVersion: selectedProfile.profileVersion } }
}
