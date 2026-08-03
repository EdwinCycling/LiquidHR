import type { Database } from '@scope/db'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { TalentComparisonOutcome } from './comparison-service'
import type { TalentRoleExplorerListQuery } from './role-explorer-schemas'

export type TalentRoleExplorerMode = 'self' | 'manager' | 'admin'

type RequirementRow = Database['public']['Tables']['job_profile_capability_requirements']['Row']
type RecordRow = Database['public']['Tables']['talent_employee_capability_records']['Row']
type LevelRow = Database['public']['Tables']['talent_levels']['Row']
type PlacementRow = Pick<Database['public']['Tables']['employee_organizations']['Row'], 'employee_id' | 'job_id' | 'job_title' | 'effective_from'>
type EmployeeRow = Pick<Database['public']['Tables']['employees']['Row'], 'id' | 'employee_number' | 'first_name' | 'birth_name'>
type CapabilityRow = Pick<Database['public']['Tables']['talent_capabilities']['Row'], 'id' | 'code' | 'name' | 'capability_type'>

export type TalentRoleExplorerProfileOption = {
  profileVersionId: string
  jobId: string
  jobCode: string
  jobGroupName: string | null
  profileVersion: number
}

export type TalentRoleExplorerEmployeeOption = {
  employeeId: string
  employeeNumber: string
  employeeLabel: string
  jobId: string | null
  jobTitle: string | null
}

export type TalentRoleExplorerAxis = {
  requirementId: string
  capabilityId: string
  capabilityCode: string
  capabilityName: string
  capabilityType: string
  requirementType: string
  targetLevelCode: string | null
  targetLevelRank: number | null
  targetLanguageLevel: string | null
  currentLevelCode: string | null
  currentLevelRank: number | null
  currentLanguageLevel: string | null
  status: TalentComparisonOutcome
  sourceType: string | null
  validFrom: string | null
  validUntil: string | null
  sourceRecordId: string | null
  rationale: string | null
}

export type TalentRoleExplorerComparison = {
  employee: TalentRoleExplorerEmployeeOption
  profile: TalentRoleExplorerProfileOption
  axes: TalentRoleExplorerAxis[]
}

export type TalentRoleExplorerWorkspace = {
  mode: TalentRoleExplorerMode
  asOf: string
  profiles: TalentRoleExplorerProfileOption[]
  employees: TalentRoleExplorerEmployeeOption[]
  selectedEmployeeId: string | null
  selectedProfileVersionId: string | null
  comparison: TalentRoleExplorerComparison | null
}

function employeeLabel(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name].filter((value) => value.trim().length > 0).join(' ').trim() || employee.employee_number
}

function isCurrent(validFrom: string, validUntil: string | null, today: string): boolean {
  return validFrom <= today && (validUntil === null || validUntil > today)
}

function levelRank(levels: LevelRow[], id: string | null): number | null {
  if (!id) return null
  return levels.find((level) => level.id === id)?.sort_order ?? null
}

function levelCode(levels: LevelRow[], id: string | null): string | null {
  if (!id) return null
  return levels.find((level) => level.id === id)?.code ?? null
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

function outcome(requirement: RequirementRow, capability: CapabilityRow | undefined, record: RecordRow | undefined, levels: LevelRow[], today: string): TalentComparisonOutcome {
  if (!capability || !record) return 'GAP'
  if (record.status !== 'RELEASED' || !isCurrent(record.valid_from, record.valid_until, today)) return 'UNKNOWN'
  if (capability.capability_type === 'CERTIFICATE' && record.evidence_status !== 'VERIFIED') return 'MISSING_EVIDENCE'
  const targetRank = levelRank(levels, requirement.target_level_id)
  if (targetRank !== null) {
    const currentRank = levelRank(levels, record.talent_level_id)
    if (currentRank === null || currentRank < targetRank) return 'GAP'
  }
  if (requirement.language_level) {
    const currentLanguageRank = languageRank(record.language_level)
    const targetLanguageRank = languageRank(requirement.language_level)
    if (currentLanguageRank === null || targetLanguageRank === null) return 'UNKNOWN'
    if (currentLanguageRank < targetLanguageRank) return 'GAP'
  }
  return 'MATCH'
}

async function authorize(mode: TalentRoleExplorerMode): Promise<AuthContext> {
  if (mode !== 'self') return requirePermission('talent-comparison:read')
  const context = await requireAuthContext()
  if (!context.employeeId) throw new TalentRoleExplorerError('EMPLOYEE_CONTEXT_REQUIRED', 403)
  await requirePermission('talent-comparison:read', context.employeeId)
  return context
}

export class TalentRoleExplorerError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentRoleExplorerError'
  }
}

export async function listTalentRoleExplorerWorkspace(mode: TalentRoleExplorerMode, query: TalentRoleExplorerListQuery = {}): Promise<TalentRoleExplorerWorkspace> {
  const context = await authorize(mode)
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const profilesQuery = supabase
    .from('talent_job_profile_readmodel')
    .select('tenant_id,job_profile_id,job_id,job_code,job_group_name,profile_version_id,version_number,status,valid_from,valid_until')
    .eq('tenant_id', context.tenantId)
    .eq('job_is_active', true)
    .eq('status', 'ACTIVE')
    .not('profile_version_id', 'is', null)
    .lte('valid_from', today)
    .or(`valid_until.is.null,valid_until.gt.${today}`)
    .order('job_code')
    .limit(500)

  let placementsQuery = supabase
    .from('employee_organizations')
    .select('employee_id,job_id,job_title,effective_from')
    .eq('tenant_id', context.tenantId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gt.${today}`)
    .order('effective_from', { ascending: false })
    .limit(mode === 'self' ? 10 : 5000)
  if (mode === 'self') {
    placementsQuery = placementsQuery.eq('employee_id', context.employeeId as string)
  } else if (mode === 'manager') {
    if (!context.employeeId) throw new TalentRoleExplorerError('EMPLOYEE_CONTEXT_REQUIRED', 403)
    placementsQuery = placementsQuery.eq('direct_manager_id', context.employeeId)
  }

  const [profilesResult, placementsResult] = await Promise.all([profilesQuery, placementsQuery])
  if (profilesResult.error || placementsResult.error) throw new TalentRoleExplorerError('TALENT_ROLE_EXPLORER_SCOPE_READ_FAILED')

  const profiles = (profilesResult.data ?? []).flatMap((profile): TalentRoleExplorerProfileOption[] => {
    if (!profile.profile_version_id || !profile.job_id || !profile.job_code) return []
    return [{
      profileVersionId: profile.profile_version_id,
      jobId: profile.job_id,
      jobCode: profile.job_code,
      jobGroupName: profile.job_group_name,
      profileVersion: profile.version_number ?? 0,
    }]
  })
  const placementByEmployee = new Map<string, PlacementRow>()
  for (const placement of placementsResult.data ?? []) {
    if (!placementByEmployee.has(placement.employee_id)) placementByEmployee.set(placement.employee_id, placement)
  }
  const employeeIds = mode === 'self' && context.employeeId ? [context.employeeId] : [...placementByEmployee.keys()]
  const employeesResult = employeeIds.length > 0
    ? await supabase.from('employees').select('id,employee_number,first_name,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).order('employee_number').limit(5000)
    : { data: [], error: null }
  if (employeesResult.error) throw new TalentRoleExplorerError('TALENT_ROLE_EXPLORER_EMPLOYEE_READ_FAILED')
  const employees = (employeesResult.data ?? []).flatMap((employee): TalentRoleExplorerEmployeeOption[] => {
    const placement = placementByEmployee.get(employee.id)
    if (mode !== 'self' && !placement) return []
    return [{
      employeeId: employee.id,
      employeeNumber: employee.employee_number,
      employeeLabel: employeeLabel(employee),
      jobId: placement?.job_id ?? null,
      jobTitle: placement?.job_title ?? null,
    }]
  })

  const selectedEmployeeId = mode === 'self'
    ? context.employeeId
    : query.employeeId && employees.some((employee) => employee.employeeId === query.employeeId) ? query.employeeId : null
  const selectedProfileVersionId = query.profileVersionId && profiles.some((profile) => profile.profileVersionId === query.profileVersionId) ? query.profileVersionId : null
  if (!selectedEmployeeId || !selectedProfileVersionId) return { mode, asOf: today, profiles, employees, selectedEmployeeId, selectedProfileVersionId, comparison: null }

  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId)
  const selectedProfile = profiles.find((profile) => profile.profileVersionId === selectedProfileVersionId)
  if (!selectedEmployee || !selectedProfile) throw new TalentRoleExplorerError('TALENT_ROLE_EXPLORER_SELECTION_INVALID', 400)

  const requirementsResult = await supabase.from('job_profile_capability_requirements').select('*').eq('tenant_id', context.tenantId).eq('profile_version_id', selectedProfileVersionId).order('sort_order').limit(500)
  if (requirementsResult.error) throw new TalentRoleExplorerError('TALENT_ROLE_EXPLORER_REQUIREMENTS_READ_FAILED')
  const requirementRows = requirementsResult.data ?? []
  const capabilityIds = [...new Set(requirementRows.map((requirement) => requirement.capability_id))]
  const [capabilitiesResult, levelsResult, recordsResult] = await Promise.all([
    capabilityIds.length > 0 ? supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('talent_levels').select('*').eq('tenant_id', context.tenantId).order('sort_order').limit(100),
    capabilityIds.length > 0 ? supabase.from('talent_employee_capability_records').select('*').eq('tenant_id', context.tenantId).eq('employee_id', selectedEmployeeId).in('capability_id', capabilityIds).in('status', ['DRAFT', 'RELEASED', 'EXPIRED']).order('valid_from', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
  ])
  if (capabilitiesResult.error || levelsResult.error || recordsResult.error) throw new TalentRoleExplorerError('TALENT_ROLE_EXPLORER_DATA_READ_FAILED')

  const capabilityById = new Map((capabilitiesResult.data ?? []).map((capability) => [capability.id, capability]))
  const levelRows = levelsResult.data ?? []
  const recordByCapability = new Map<string, RecordRow>()
  for (const record of recordsResult.data ?? []) {
    const current = recordByCapability.get(record.capability_id)
    if (!current || recordPriority(record, today) > recordPriority(current, today)) recordByCapability.set(record.capability_id, record)
  }

  const axes = requirementRows.map((requirement) => {
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
      targetLevelRank: levelRank(levelRows, requirement.target_level_id),
      targetLanguageLevel: requirement.language_level,
      currentLevelCode: isReleasedCurrent ? levelCode(levelRows, record?.talent_level_id ?? null) : null,
      currentLevelRank: isReleasedCurrent ? levelRank(levelRows, record?.talent_level_id ?? null) : null,
      currentLanguageLevel: isReleasedCurrent ? record?.language_level ?? null : null,
      status: outcome(requirement, capability, record, levelRows, today),
      sourceType: isReleasedCurrent ? record?.source_type ?? null : null,
      validFrom: isReleasedCurrent ? record?.valid_from ?? null : null,
      validUntil: isReleasedCurrent ? record?.valid_until ?? null : null,
      sourceRecordId: isReleasedCurrent ? record?.id ?? null : null,
      rationale: requirement.rationale,
    } satisfies TalentRoleExplorerAxis
  })

  return { mode, asOf: today, profiles, employees, selectedEmployeeId, selectedProfileVersionId, comparison: { employee: selectedEmployee, profile: selectedProfile, axes } }
}
