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

type PensionArrangement = Database['public']['Tables']['pension_arrangements']['Row']
type PensionArrangementVersion = Database['public']['Tables']['pension_arrangement_versions']['Row']
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
  readonly sourceStatus: 'VALIDATED' | 'REVIEW_REQUIRED'
  readonly sourceJson: Json
  readonly versionNumber: number | null
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
  readonly administrationId: string
}

function isObject(value: Json): value is { readonly [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sourceStatus(source: Json): 'VALIDATED' | 'REVIEW_REQUIRED' {
  if (!isObject(source)) return 'REVIEW_REQUIRED'
  const status = source.legalFiscalStatus ?? source.sourceValidationStatus ?? source.validationStatus
  return status === 'VALIDATED' || status === 'VERIFIED' ? 'VALIDATED' : 'REVIEW_REQUIRED'
}

function pensionHash(arrangement: PensionArrangement, version: PensionArrangementVersion | null): string {
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
      provenance: version.provenance_json,
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
      .select('id, pension_arrangement_id, version_number, effective_from, effective_to, provenance_json')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId)
      .in('pension_arrangement_id', arrangementIds)
      .order('version_number', { ascending: false })
  if (versionsResult.error) throw new Error('CAO_SETUP_PENSION_VERSION_READ_FAILED')
  const versionsByArrangementId = new Map<string, PensionArrangementVersion>()
  for (const version of versionsResult.data ?? []) {
    if (!versionsByArrangementId.has(version.pension_arrangement_id)) versionsByArrangementId.set(version.pension_arrangement_id, version as PensionArrangementVersion)
  }
  const pensions = arrangements.map((arrangement) => {
    const version = versionsByArrangementId.get(arrangement.id) ?? null
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
      sourceStatus: sourceStatus(version?.provenance_json ?? arrangement.provenance_json),
      sourceJson: version?.provenance_json ?? arrangement.provenance_json,
      versionNumber: version?.version_number ?? null,
      sourceHash: pensionHash(arrangement, version),
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
  return {
    employmentSettings: settings,
    catalog: CAO_SETUP_CATALOG,
    pensions,
    pensionMappings,
    administrationId: context.administrationId,
  }
}

export function resolveCaoSetupForLaborCondition(code: string | null, name: string | null): CaoSetupCatalogEntry | null {
  return findCaoSetupCatalogEntry(code, name)
}
