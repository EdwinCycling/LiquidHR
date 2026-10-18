import 'server-only'

import type { Database, Json } from '@scope/db'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getEmploymentSettings } from '@/lib/employment/employment-settings'
import {
  CAO_SETUP_CATALOG,
  findCaoSetupCatalogEntry,
  type CaoSetupCatalogEntry,
} from './cao-setup-catalog'
import { buildCaoSetupCompleteness, type CaoSetupCompletenessRecord } from './cao-setup-completeness'

type PensionArrangement = Database['public']['Tables']['pension_arrangements']['Row']
type PensionArrangementVersion = Database['public']['Tables']['pension_arrangement_versions']['Row']
type PensionArrangementVersionTier = Database['public']['Tables']['pension_arrangement_version_tiers']['Row']
type LaborConditionPensionMapping = Database['public']['Tables']['labor_condition_pension_arrangements']['Row']

export type CaoSetupPensionRecord = {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly arrangementType: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly flatTotalRate: number | null
  readonly employeeSharePct: number
  readonly employerSharePct: number
  readonly annualFranchise: number
  readonly annualPensionableSalaryCap: number | null
  readonly pensionableSalaryDefinition: Json
  readonly eligibilityRule: Json
  readonly sourceStatus: 'VALIDATED' | 'REVIEW_REQUIRED'
  readonly sourceJson: Json
  readonly versionNumber: number | null
  readonly currentVersionId: string | null
  readonly successorDraft: Json | null
  readonly sourceHash: string
}

export type CaoSetupPensionMapping = {
  readonly id: string
  readonly laborConditionSetId: string
  readonly pensionArrangementId: string
  readonly participantGroup: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly versionNumber: number
  readonly sourceStatus: 'VALIDATED' | 'REVIEW_REQUIRED'
}

export type CaoSetupPageData = {
  readonly employmentSettings: Awaited<ReturnType<typeof getEmploymentSettings>>
  readonly catalog: readonly CaoSetupCatalogEntry[]
  readonly pensions: readonly CaoSetupPensionRecord[]
  readonly pensionMappings: readonly CaoSetupPensionMapping[]
  readonly completeness: readonly CaoSetupCompletenessRecord[]
  readonly administrationId: string
  readonly canManage: boolean
}

function isObject(value: Json): value is { readonly [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sourceStatus(source: Json): 'VALIDATED' | 'REVIEW_REQUIRED' {
  if (!isObject(source)) return 'REVIEW_REQUIRED'
  const status = source.legalFiscalStatus ?? source.sourceValidationStatus ?? source.validationStatus
  return status === 'VALIDATED' || status === 'VERIFIED' ? 'VALIDATED' : 'REVIEW_REQUIRED'
}

function pensionHash(arrangement: PensionArrangement, version: PensionArrangementVersion | null, tiers: readonly PensionArrangementVersionTier[]): string {
  return sha256(stableSerialize({
    arrangement: {
      id: arrangement.id,
      code: arrangement.code,
      effectiveFrom: arrangement.effective_from,
      effectiveTo: arrangement.effective_to,
      arrangementType: arrangement.arrangement_type,
      flatTotalRate: arrangement.flat_total_rate,
      employeeSharePct: arrangement.employee_share_pct,
      employerSharePct: arrangement.employer_share_pct,
      annualFranchise: arrangement.annual_franchise,
      annualPensionableSalaryCap: arrangement.annual_pensionable_salary_cap,
      pensionableSalaryDefinition: arrangement.pensionable_salary_definition,
      eligibilityRule: arrangement.eligibility_rule,
      provenance: arrangement.provenance_json,
    },
    version: version ? {
      id: version.id,
      versionNumber: version.version_number,
      effectiveFrom: version.effective_from,
      effectiveTo: version.effective_to,
      arrangementType: version.arrangement_type,
      transitionDate: version.transition_date,
      grandfatheringMode: version.grandfathering_mode,
      flatTotalRate: version.flat_total_rate,
      employerSharePct: version.employer_share_pct,
      employeeSharePct: version.employee_share_pct,
      annualFranchise: version.annual_franchise,
      annualPensionableSalaryCap: version.annual_pensionable_salary_cap,
      pensionableSalaryDefinition: version.pensionable_salary_definition,
      eligibilityRule: version.eligibility_rule,
      contractClassification: version.contract_classification,
      contractClassificationProvenance: version.contract_classification_provenance,
      provenance: version.provenance_json,
      tiers: tiers.map((tier) => ({ id: tier.id, minAge: tier.min_age, maxAge: tier.max_age, totalRate: tier.total_rate })),
    } : null,
  }))
}

export async function getCaoSetupPageData(
  employmentSettings?: Awaited<ReturnType<typeof getEmploymentSettings>>,
): Promise<CaoSetupPageData> {
  const context = await requirePermission('contract:read')
  if (!context.administrationId || !context.hrGroupId) throw new Error('CAO_SETUP_SCOPE_REQUIRED')
  const settings = employmentSettings ?? await getEmploymentSettings()
  const supabase = await createClient()
  const canManage = await requirePermission('pension:manage')
    .then((manager) => manager.tenantId === context.tenantId
      && manager.hrGroupId === context.hrGroupId
      && manager.administrationId === context.administrationId
      && (manager.activeRoles.includes('HR_ADMIN') || manager.activeRoles.includes('TENANT_ADMIN')))
    .catch(() => false)
  const [arrangementsResult, mappingsResult] = await Promise.all([
    supabase.from('pension_arrangements')
      .select('id, code, name, arrangement_type, effective_from, effective_to, flat_total_rate, employee_share_pct, employer_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, provenance_json, is_active')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId)
      .eq('is_active', true)
      .order('name')
      .limit(100),
    supabase.from('labor_condition_pension_arrangements')
      .select('id, labor_condition_set_id, pension_arrangement_id, participant_group, effective_from, effective_to, provenance_json, version_number')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId)
      .order('effective_from', { ascending: false })
      .limit(500),
  ])
  if (arrangementsResult.error || mappingsResult.error) throw new Error('CAO_SETUP_PENSION_READ_FAILED')
  const arrangements = (arrangementsResult.data ?? []) as PensionArrangement[]
  const arrangementIds = arrangements.map((arrangement) => arrangement.id)
  const versionsResult = arrangementIds.length === 0
    ? { data: [] as PensionArrangementVersion[], error: null }
    : await supabase.from('pension_arrangement_versions')
      .select('id, pension_arrangement_id, version_number, supersedes_version_id, code, name, arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, contract_classification, contract_classification_provenance, provenance_json, is_active, supersession_reason, supersession_provenance, created_at, created_by_user_id, tenant_id, hr_group_id, administration_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId)
      .in('pension_arrangement_id', arrangementIds)
      .order('version_number', { ascending: false })
  if (versionsResult.error) throw new Error('CAO_SETUP_PENSION_VERSION_READ_FAILED')
  const versions = (versionsResult.data ?? []) as PensionArrangementVersion[]
  const versionIds = versions.map((version) => version.id)
  const tiersResult = versionIds.length === 0
    ? { data: [] as PensionArrangementVersionTier[], error: null }
    : await supabase.from('pension_arrangement_version_tiers')
      .select('id, pension_arrangement_version_id, pension_arrangement_id, min_age, max_age, total_rate, created_at, tenant_id, hr_group_id, administration_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId)
      .in('pension_arrangement_version_id', versionIds)
      .order('min_age')
  if (tiersResult.error) throw new Error('CAO_SETUP_PENSION_VERSION_READ_FAILED')
  const versionTiersById = new Map<string, PensionArrangementVersionTier[]>()
  for (const tier of (tiersResult.data ?? []) as PensionArrangementVersionTier[]) {
    const rows = versionTiersById.get(tier.pension_arrangement_version_id) ?? []
    versionTiersById.set(tier.pension_arrangement_version_id, [...rows, tier])
  }
  const versionsByArrangementId = new Map<string, PensionArrangementVersion>()
  for (const version of versions) {
    if (!versionsByArrangementId.has(version.pension_arrangement_id)) versionsByArrangementId.set(version.pension_arrangement_id, version as PensionArrangementVersion)
  }
  const pensions = arrangements.map((arrangement) => {
    const version = versionsByArrangementId.get(arrangement.id) ?? null
    const versionTiers = version ? versionTiersById.get(version.id) ?? [] : []
    const successorDraft: Json | null = version ? {
      effective_from: version.effective_from,
      effective_to: version.effective_to,
      arrangement_type: version.arrangement_type,
      transition_date: version.transition_date,
      grandfathering_mode: version.grandfathering_mode,
      flat_total_rate: version.flat_total_rate,
      employer_share_pct: version.employer_share_pct,
      employee_share_pct: version.employee_share_pct,
      annual_franchise: version.annual_franchise,
      annual_pensionable_salary_cap: version.annual_pensionable_salary_cap,
      pensionable_salary_definition: version.pensionable_salary_definition,
      eligibility_rule: version.eligibility_rule,
      contract_classification: version.contract_classification,
      contract_classification_provenance: version.contract_classification_provenance,
      provenance_json: version.provenance_json,
      is_active: version.is_active,
      tiers: versionTiers.map((tier) => ({ min_age: tier.min_age, max_age: tier.max_age, total_rate: tier.total_rate })),
      supersession_reason: 'Explicit configuration correction through the versioned pension arrangement settings.',
      supersession_provenance: { status: 'USER_RECORDED', interface: 'pension-arrangement-settings' },
    } : null
    return {
      id: arrangement.id,
      code: arrangement.code,
      name: arrangement.name,
      arrangementType: arrangement.arrangement_type,
      effectiveFrom: arrangement.effective_from,
      effectiveTo: arrangement.effective_to,
      flatTotalRate: arrangement.flat_total_rate,
      employeeSharePct: arrangement.employee_share_pct,
      employerSharePct: arrangement.employer_share_pct,
      annualFranchise: arrangement.annual_franchise,
      annualPensionableSalaryCap: arrangement.annual_pensionable_salary_cap,
      pensionableSalaryDefinition: version?.pensionable_salary_definition ?? arrangement.pensionable_salary_definition,
      eligibilityRule: version?.eligibility_rule ?? arrangement.eligibility_rule,
      sourceStatus: sourceStatus(version?.provenance_json ?? arrangement.provenance_json),
      sourceJson: version?.provenance_json ?? arrangement.provenance_json,
      versionNumber: version?.version_number ?? null,
      currentVersionId: version?.id ?? null,
      successorDraft,
      sourceHash: pensionHash(arrangement, version, versionTiers),
    } satisfies CaoSetupPensionRecord
  })
  const pensionById = new Map(pensions.map((pension) => [pension.id, pension]))
  const pensionMappings = (mappingsResult.data ?? []).map((mapping) => {
    const row = mapping as LaborConditionPensionMapping
    return {
      id: row.id,
      laborConditionSetId: row.labor_condition_set_id,
      pensionArrangementId: row.pension_arrangement_id,
      participantGroup: row.participant_group,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      versionNumber: row.version_number,
      sourceStatus: pensionById.get(row.pension_arrangement_id)?.sourceStatus ?? sourceStatus(row.provenance_json),
    } satisfies CaoSetupPensionMapping
  })
  const completeness = buildCaoSetupCompleteness({
    catalog: CAO_SETUP_CATALOG,
    laborConditionTimelines: settings.laborConditionTimelines,
    salaryStructureCatalog: settings.salaryStructureCatalog,
    pensions,
    pensionMappings,
  })
  return {
    employmentSettings: settings,
    catalog: CAO_SETUP_CATALOG,
    pensions,
    pensionMappings,
    completeness,
    administrationId: context.administrationId,
    canManage,
  }
}

export function resolveCaoSetupForLaborCondition(code: string | null, name: string | null): CaoSetupCatalogEntry | null {
  return findCaoSetupCatalogEntry(code, name)
}
