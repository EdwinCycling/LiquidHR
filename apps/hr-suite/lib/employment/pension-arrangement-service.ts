import 'server-only'

import type { Database, Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  isSyntheticPensionFixtureEnabled,
  isSyntheticPensionFixtureRuntimeEnabled,
  syntheticPensionSourceClassification,
} from './pension-arrangement-policy'

type Employment = Database['public']['Tables']['employments']['Row']
type Assignment = Database['public']['Tables']['employment_pension_arrangement_assignments']['Row']
type Arrangement = Database['public']['Tables']['pension_arrangements']['Row']
type LaborConditionPensionMapping = Database['public']['Tables']['labor_condition_pension_arrangements']['Row']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isPensionManager(context: Awaited<ReturnType<typeof requirePermission>>): boolean {
  return context.activeRoles.includes('HR_ADMIN') || context.activeRoles.includes('TENANT_ADMIN')
}

export class EmploymentPensionArrangementError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'EmploymentPensionArrangementError'
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

async function scopedEmployment(employeeId: string, employmentId: string, permission: 'contract:read' | 'contract:write' | 'pension:manage'): Promise<{
  employment: Employment
  context: Awaited<ReturnType<typeof requirePermission>>
}> {
  const context = await requirePermission(permission, employeeId)
  if (!context.administrationId || !context.hrGroupId) {
    throw new EmploymentPensionArrangementError('EMPLOYMENT_NOT_FOUND', 404)
  }
  const supabase = await createClient()
  const { data, error } = await supabase.from('employments').select('*')
    .eq('id', employmentId)
    .eq('employee_id', employeeId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('administration_id', context.administrationId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) throw new EmploymentPensionArrangementError('EMPLOYMENT_NOT_FOUND', 404)
  return { employment: data, context }
}

export async function getEmploymentPensionArrangementPageData(employeeId: string, employmentId: string) {
  const { employment, context } = await scopedEmployment(employeeId, employmentId, 'contract:read')
  const supabase = await createClient()
  const [arrangementsResult, assignmentsResult, contractsResult] = await Promise.all([
    supabase.from('pension_arrangements')
      .select('id, code, name, arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, employer_share_pct, employee_share_pct, is_active')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .eq('is_active', true)
      .order('name')
      .limit(100),
    supabase.from('employment_pension_arrangement_assignments')
      .select('id, pension_arrangement_id, effective_from, effective_to, participation_start_date, assignment_reason, provenance_json, updated_at, version_number, supersedes_assignment_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .eq('employment_id', employment.id)
      .order('effective_from', { ascending: false })
      .limit(100),
    supabase.from('employment_contracts')
      .select('id, labor_condition_set_id, starts_on, ends_on')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .eq('employee_id', employeeId)
      .eq('employment_id', employment.id)
      .order('starts_on', { ascending: false })
      .limit(100),
  ])
  if (arrangementsResult.error || assignmentsResult.error || contractsResult.error) {
    throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_READ_FAILED', 500)
  }
  const canWrite = await requirePermission('pension:manage', employeeId)
    .then((writeContext) => isPensionManager(writeContext)
      && writeContext.tenantId === context.tenantId
      && writeContext.hrGroupId === context.hrGroupId
      && writeContext.administrationId === context.administrationId)
    .catch(() => false)
  const today = new Date().toISOString().slice(0, 10)
  const currentContracts = (contractsResult.data ?? []).filter((contract) => contract.starts_on <= today
    && (contract.ends_on === null || contract.ends_on >= today)
    && contract.labor_condition_set_id !== null)
  const currentLaborConditionSetId = currentContracts.length === 1 ? currentContracts[0]!.labor_condition_set_id : null
  const laborConditionSetResult = currentLaborConditionSetId
    ? await supabase.from('labor_condition_sets')
      .select('id, code, name')
      .eq('id', currentLaborConditionSetId)
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .maybeSingle()
    : { data: null, error: null }
  if (laborConditionSetResult.error) throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_READ_FAILED', 500)
  const laborMappingResult = currentLaborConditionSetId
    ? await supabase.from('labor_condition_pension_arrangements')
      .select('id, labor_condition_set_id, pension_arrangement_id, participant_group, effective_from, effective_to, provenance_json, version_number, supersedes_mapping_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .eq('labor_condition_set_id', currentLaborConditionSetId)
      .order('effective_from', { ascending: false })
      .limit(100)
    : { data: [], error: null }
  if (laborMappingResult.error) throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_READ_FAILED', 500)
  const arrangements = (arrangementsResult.data ?? []) as Pick<Arrangement,
    'id' | 'code' | 'name' | 'arrangement_type' | 'effective_from' | 'effective_to' | 'transition_date'
    | 'grandfathering_mode' | 'employer_share_pct' | 'employee_share_pct' | 'is_active'>[]
  const byId = new Map(arrangements.map((row) => [row.id, row]))
  const laborConditionMappings = (laborMappingResult.data ?? []) as Pick<LaborConditionPensionMapping,
    'id' | 'labor_condition_set_id' | 'pension_arrangement_id' | 'participant_group' | 'effective_from' | 'effective_to'
    | 'provenance_json' | 'version_number' | 'supersedes_mapping_id'>[]
  const arrangementIds = arrangements.map((row) => row.id)
  const versionsResult = arrangementIds.length > 0
    ? await supabase.from('pension_arrangement_versions')
      .select('id, pension_arrangement_id, version_number, supersedes_version_id, code, name, arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, contract_classification, contract_classification_provenance, provenance_json, is_active, supersession_reason, supersession_provenance, created_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .in('pension_arrangement_id', arrangementIds)
      .order('version_number', { ascending: false })
    : { data: [], error: null }
  if (versionsResult.error) throw new EmploymentPensionArrangementError('PENSION_VERSION_READ_FAILED', 500)
  const versionIds = (versionsResult.data ?? []).map((version) => version.id)
  const versionTiersResult = versionIds.length > 0
    ? await supabase.from('pension_arrangement_version_tiers')
      .select('id, pension_arrangement_version_id, min_age, max_age, total_rate, created_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('administration_id', context.administrationId!)
      .in('pension_arrangement_version_id', versionIds)
      .order('min_age')
    : { data: [], error: null }
  if (versionTiersResult.error) throw new EmploymentPensionArrangementError('PENSION_VERSION_READ_FAILED', 500)
  const versionTiersById = new Map<string, NonNullable<typeof versionTiersResult.data>>()
  for (const tier of versionTiersResult.data ?? []) {
    const tiers = versionTiersById.get(tier.pension_arrangement_version_id) ?? []
    versionTiersById.set(tier.pension_arrangement_version_id, [...tiers, tier])
  }
  const versionsByArrangementId = new Map<string, NonNullable<typeof versionsResult.data>>()
  for (const version of versionsResult.data ?? []) {
    const rows = versionsByArrangementId.get(version.pension_arrangement_id) ?? []
    versionsByArrangementId.set(version.pension_arrangement_id, [...rows, version])
  }
  const syntheticFixtureAuth = canWrite && isSyntheticPensionFixtureRuntimeEnabled()
    ? await supabase.auth.getUser()
    : null
  const canCreateSyntheticFixture = canWrite
    && syntheticFixtureAuth?.error == null
    && isSyntheticPensionFixtureEnabled(process.env, syntheticFixtureAuth?.data.user?.app_metadata)
  return {
    employment,
    arrangements,
    versionsByArrangementId,
    versionTiersById,
    canWrite,
    canCreateSyntheticFixture,
    laborConditionSet: laborConditionSetResult.data,
    laborConditionMappings: laborConditionMappings.map((row) => ({
      ...row,
      arrangement: byId.get(row.pension_arrangement_id) ?? null,
    })),
    assignments: ((assignmentsResult.data ?? []) as Pick<Assignment,
      'id' | 'pension_arrangement_id' | 'effective_from' | 'effective_to' | 'participation_start_date'
      | 'assignment_reason' | 'provenance_json' | 'updated_at' | 'version_number' | 'supersedes_assignment_id'>[]).map((row) => ({
      ...row,
      arrangement: byId.get(row.pension_arrangement_id) ?? null,
    })),
  }
}

export async function createPensionArrangementSuccessor(input: {
  readonly employeeId: string
  readonly employmentId: string
  readonly predecessorVersionId: string
  readonly successor: Json
}): Promise<{ readonly versionId: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.predecessorVersionId)
    || !input.successor || typeof input.successor !== 'object' || Array.isArray(input.successor)) {
    throw new EmploymentPensionArrangementError('PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID', 400)
  }
  const { context } = await scopedEmployment(input.employeeId, input.employmentId, 'contract:write')
  const supabase = await createClient()
  const { data: predecessor, error: predecessorError } = await supabase.from('pension_arrangement_versions')
    .select('id, pension_arrangement_id')
    .eq('id', input.predecessorVersionId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId!)
    .eq('administration_id', context.administrationId!)
    .maybeSingle()
  if (predecessorError || !predecessor) {
    throw new EmploymentPensionArrangementError('PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND', 404)
  }
  const { data, error } = await supabase.rpc('create_pension_arrangement_successor', {
    p_predecessor_version_id: predecessor.id,
    p_successor: input.successor,
  })
  if (error || !data) {
    const knownCode = error?.message.match(/PENSION_[A-Z_]+/)?.[0]
    throw new EmploymentPensionArrangementError(knownCode ?? 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED', 400)
  }
  return { versionId: data }
}

export async function assignEmploymentPensionArrangement(input: {
  readonly employeeId: string
  readonly employmentId: string
  readonly arrangementId: string
  readonly participationStartDate: string
  readonly effectiveFrom: string
  readonly effectiveTo?: string | null
  readonly participantGroup: 'NEW_ENTRANT' | 'GRANDFATHERED'
  readonly confirmMapping: boolean
  readonly requestKey: string
  readonly supersedesMappingId?: string | null
  readonly supersedesAssignmentId?: string | null
  readonly provenance: { readonly status: 'USER_RECORDED' }
    | { readonly status: 'SYNTHETIC_TEST_FIXTURE'; readonly scenario: string }
}): Promise<{
  readonly assignmentId: string
  readonly mappingId: string
  readonly assignmentVersion: number
  readonly mappingVersion: number
  readonly assignmentReused: boolean
  readonly mappingReused: boolean
}> {
  const effectiveTo = input.effectiveTo ?? null
  if (!UUID_PATTERN.test(input.employeeId) || !UUID_PATTERN.test(input.employmentId) || !UUID_PATTERN.test(input.arrangementId)
    || !UUID_PATTERN.test(input.requestKey)
    || (input.supersedesMappingId && !UUID_PATTERN.test(input.supersedesMappingId))
    || (input.supersedesAssignmentId && !UUID_PATTERN.test(input.supersedesAssignmentId))
    || !isIsoDate(input.participationStartDate) || !isIsoDate(input.effectiveFrom)
    || (effectiveTo !== null && !isIsoDate(effectiveTo))
    || input.participationStartDate > input.effectiveFrom
    || (effectiveTo !== null && effectiveTo < input.effectiveFrom)
    || !['NEW_ENTRANT', 'GRANDFATHERED'].includes(input.participantGroup)
    || input.confirmMapping !== true) {
    throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_INPUT_INVALID', 400)
  }
  const { employment, context } = await scopedEmployment(input.employeeId, input.employmentId, 'pension:manage')
  if (!isPensionManager(context)) throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_FORBIDDEN', 403)

  const supabase = await createClient()
  let provenance: Json
  if (input.provenance.status === 'SYNTHETIC_TEST_FIXTURE') {
    if (!isSyntheticPensionFixtureRuntimeEnabled()) {
      throw new EmploymentPensionArrangementError('PENSION_TEST_FIXTURE_DISABLED', 403)
    }
    const authResult = await supabase.auth.getUser()
    if (authResult.error || !isSyntheticPensionFixtureEnabled(process.env, authResult.data.user?.app_metadata)) {
      throw new EmploymentPensionArrangementError('PENSION_TEST_FIXTURE_DISABLED', 403)
    }
    const sourceClassification = syntheticPensionSourceClassification(input.provenance.scenario)
    if (!sourceClassification) throw new EmploymentPensionArrangementError('PENSION_SYNTHETIC_PROVENANCE_INVALID', 400)
    provenance = {
      schemaVersion: 'EMPLOYMENT_PENSION_ASSIGNMENT_PROVENANCE_V1',
      status: 'SYNTHETIC_TEST_FIXTURE',
      sourceClassification,
      source: 'Explicit HR-admin synthetic TEST pension arrangement workflow.',
      legalFiscalStatus: 'OPEN',
      legalFiscalGap: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
    }
  } else {
    provenance = {
      schemaVersion: 'EMPLOYMENT_PENSION_ASSIGNMENT_PROVENANCE_V1',
      status: 'USER_RECORDED',
      sourceClassification: 'CORE_PENSION_ASSIGNMENT_WORKFLOW',
      source: 'Explicit HR-admin pension arrangement workflow in Core.',
      legalFiscalStatus: 'OPEN',
      legalFiscalGap: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
    }
  }

  const { data, error } = await supabase.rpc('apply_employment_pension_arrangement', {
    p_input: {
      employee_id: input.employeeId,
      employment_id: employment.id,
      arrangement_id: input.arrangementId,
      request_key: input.requestKey,
      participation_start_date: input.participationStartDate,
      effective_from: input.effectiveFrom,
      effective_to: effectiveTo,
      participant_group: input.participantGroup,
      confirm_mapping: input.confirmMapping,
      supersedes_mapping_id: input.supersedesMappingId ?? null,
      supersedes_assignment_id: input.supersedesAssignmentId ?? null,
      assignment_reason: 'Explicit HR-admin assignment. A CAO mapping does not create assignments for other employments.',
      provenance_json: provenance,
    } satisfies Json,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    const code = error?.message.match(/PENSION_[A-Z_]+/)?.[0] ?? 'PENSION_ASSIGNMENT_WRITE_FAILED'
    const status = code.endsWith('_FORBIDDEN') || code.endsWith('_DISABLED') ? 403
      : code.endsWith('_NOT_FOUND') ? 404
        : code.includes('_OVERLAP') || code.endsWith('_ALREADY_SUPERSEDED') || code.endsWith('_CONFLICT') ? 409
          : code.endsWith('_FAILED') || code.endsWith('_READBACK_INVALID') ? 500
            : 400
    throw new EmploymentPensionArrangementError(code, status)
  }
  const result = data as Record<string, unknown>
  const assignmentId = result.assignment_id
  const mappingId = result.mapping_id
  const assignmentVersion = Number(result.assignment_version)
  const mappingVersion = Number(result.mapping_version)
  if (typeof assignmentId !== 'string' || typeof mappingId !== 'string'
    || !Number.isInteger(assignmentVersion) || !Number.isInteger(mappingVersion)) {
    throw new EmploymentPensionArrangementError('PENSION_ASSIGNMENT_WRITE_READBACK_INVALID', 500)
  }
  return {
    assignmentId,
    mappingId,
    assignmentVersion,
    mappingVersion,
    assignmentReused: result.assignment_reused === true,
    mappingReused: result.mapping_reused === true,
  }
}
