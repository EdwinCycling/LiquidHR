import 'server-only'

import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { listSalaryStructureCatalog } from '@/lib/salary-structures/service'
import { createClient } from '@/lib/supabase/server'
import { buildEmploymentRegulationTimelines } from './employment-regulation-model'

export type EmploymentCatalog = 'LABOR_CONDITION_SET' | 'FLEX_PHASE' | 'SALARY_FREQUENCY' | 'COST_CARRIER' | 'COST_CENTER'

export class EmploymentSettingsError extends Error {
  constructor(readonly code: string, readonly status: 400 | 404 | 409 | 500) {
    super(code)
  }
}

function administrationId(value: string | null): string {
  if (!value) throw new EmploymentSettingsError('ADMINISTRATION_REQUIRED', 400)
  return value
}

async function permissionAllowed(permission: string): Promise<boolean> {
  try {
    await requirePermission(permission)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

function regulationCodeBase(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return (normalized || 'REGELING').slice(0, 28)
}

async function nextRegulationCode(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, administrationIdValue: string, name: string): Promise<string> {
  const base = regulationCodeBase(name)
  const { data, error } = await supabase.from('labor_condition_sets').select('code').eq('tenant_id', tenantId).eq('administration_id', administrationIdValue).like('code', `${base}%`).limit(500)
  if (error) throw new EmploymentSettingsError('REGULATION_CODE_READ_FAILED', 500)
  const existing = new Set((data ?? []).map((row) => row.code))
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function mapRegulationMutationError(message: string | undefined): EmploymentSettingsError {
  if (message?.includes('LABOR_CONDITION_START_MUST_FOLLOW_PREDECESSOR')) return new EmploymentSettingsError('REGULATION_START_MUST_FOLLOW_PREDECESSOR', 400)
  if (message?.includes('LABOR_CONDITION_START_MUST_PRECEDE_SUCCESSOR')) return new EmploymentSettingsError('REGULATION_START_MUST_PRECEDE_SUCCESSOR', 400)
  if (message?.includes('LABOR_CONDITION_SUCCESSOR_EXISTS')) return new EmploymentSettingsError('REGULATION_SUCCESSOR_EXISTS', 409)
  if (message?.includes('LABOR_CONDITION_PREDECESSOR_NOT_FOUND')) return new EmploymentSettingsError('REGULATION_PREDECESSOR_NOT_FOUND', 404)
  if (message?.includes('LABOR_CONDITION_TIMELINE_CYCLE')) return new EmploymentSettingsError('REGULATION_TIMELINE_CYCLE', 400)
  return new EmploymentSettingsError('REGULATION_UPDATE_FAILED', 500)
}

export async function getEmploymentSettings() {
  const context = await requirePermission('contract:read')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const salaryStructureCatalogPromise = listSalaryStructureCatalog().catch((error: unknown) => {
    if (error instanceof AuthorizationError) return null
    throw error
  })
  const [settings, labor, flex, frequencies, carriers, centers, salaryStructureCatalog, canWriteSalaryApplication] = await Promise.all([
    supabase.from('administration_hr_settings').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).single(),
    supabase.from('labor_condition_sets').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('code').limit(500),
    supabase.from('flex_phases').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('sort_order').limit(500),
    supabase.from('salary_frequencies').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('code').limit(500),
    supabase.from('cost_carriers').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('code').limit(500),
    supabase.from('cost_centers').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('code').limit(500),
    salaryStructureCatalogPromise,
    permissionAllowed('salary:write'),
  ])
  if ([settings, labor, flex, frequencies, carriers, centers].some((result) => result.error) || !settings.data) {
    throw new EmploymentSettingsError('EMPLOYMENT_SETTINGS_READ_FAILED', 500)
  }
  const enabledSalaryStructureIds = new Set(settings.data.salary_structure_ids ?? [])
  const administrationSalaryStructureCatalog = salaryStructureCatalog
    ? {
      ...salaryStructureCatalog,
      structures: salaryStructureCatalog.structures.filter((structure) => enabledSalaryStructureIds.has(structure.id)),
      revisions: salaryStructureCatalog.revisions.filter((revision) => enabledSalaryStructureIds.has(revision.salary_structure_id)),
      scales: salaryStructureCatalog.scales.filter((scale) => enabledSalaryStructureIds.has(scale.salary_structure_id)),
      scaleValues: salaryStructureCatalog.scaleValues.filter((value) => salaryStructureCatalog.revisions.some((revision) => revision.id === value.salary_structure_revision_id && enabledSalaryStructureIds.has(revision.salary_structure_id))),
      steps: salaryStructureCatalog.steps.filter((step) => salaryStructureCatalog.revisions.some((revision) => revision.id === step.salary_structure_revision_id && enabledSalaryStructureIds.has(revision.salary_structure_id))),
      bands: salaryStructureCatalog.bands.filter((band) => enabledSalaryStructureIds.has(band.salary_structure_id)),
      bandValues: salaryStructureCatalog.bandValues.filter((value) => salaryStructureCatalog.revisions.some((revision) => revision.id === value.salary_structure_revision_id && enabledSalaryStructureIds.has(revision.salary_structure_id))),
      laborConditionRelations: salaryStructureCatalog.laborConditionRelations.filter((relation) => enabledSalaryStructureIds.has(relation.salary_structure_id)),
    }
    : null
  return {
    defaultCountryCode: settings.data.default_employment_country_code,
    laborConditionSets: labor.data ?? [],
    laborConditionTimelines: buildEmploymentRegulationTimelines(labor.data ?? []),
    salaryStructureCatalog: administrationSalaryStructureCatalog,
    salaryApplicationSettings: {
      routes: settings.data.salary_routes,
      structureIds: settings.data.salary_structure_ids,
      canWrite: canWriteSalaryApplication,
    },
    flexPhases: flex.data ?? [],
    salaryFrequencies: frequencies.data ?? [],
    costCarriers: carriers.data ?? [],
    costCenters: centers.data ?? [],
  }
}

export async function createEmploymentRegulation(input: { name: string; validFrom: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const groupId = requireHrGroupId(context)
  const supabase = await createClient()
  const code = await nextRegulationCode(supabase, context.tenantId, adminId, input.name)
  const result = await supabase.from('labor_condition_sets').insert({
    tenant_id: context.tenantId,
    administration_id: adminId,
    hr_group_id: groupId,
    code,
    name: input.name,
    standard_hours_per_week: input.standardHoursPerWeek,
    probation_maximum_months: input.probationMaximumMonths,
    valid_from: input.validFrom,
    predecessor_id: null,
    is_active: true,
  })
  if (result.error?.message.includes('probation_maximum_months')) {
    const fallback = await supabase.from('labor_condition_sets').insert({
      tenant_id: context.tenantId,
      administration_id: adminId,
      hr_group_id: groupId,
      code,
      name: input.name,
      standard_hours_per_week: input.standardHoursPerWeek,
      valid_from: input.validFrom,
      predecessor_id: null,
      is_active: true,
    })
    if (fallback.error) throw mapRegulationMutationError(fallback.error.message)
    return
  }
  if (result.error) throw mapRegulationMutationError(result.error.message)
}

export async function updateEmploymentRegulation(id: string, input: { name: string; validFrom: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const result = await supabase.from('labor_condition_sets').update({
    name: input.name,
    valid_from: input.validFrom,
    standard_hours_per_week: input.standardHoursPerWeek,
    probation_maximum_months: input.probationMaximumMonths,
  }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
  if (result.error?.message.includes('probation_maximum_months')) {
    const fallback = await supabase.from('labor_condition_sets').update({
      name: input.name,
      valid_from: input.validFrom,
      standard_hours_per_week: input.standardHoursPerWeek,
    }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
    if (fallback.error) throw mapRegulationMutationError(fallback.error.message)
    return
  }
  if (result.error) throw mapRegulationMutationError(result.error.message)
}

export async function createEmploymentRegulationSuccessor(input: { predecessorId: string; name: string; validFrom: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_labor_condition_successor', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: adminId,
    requested_predecessor_id: input.predecessorId,
    requested_name: input.name,
    requested_valid_from: input.validFrom,
    requested_standard_hours_per_week: input.standardHoursPerWeek,
  })
  if (error) throw mapRegulationMutationError(error.message)
  if (data?.id) {
    const update = await supabase.from('labor_condition_sets').update({ probation_maximum_months: input.probationMaximumMonths })
      .eq('id', data.id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
    if (update.error && !update.error.message.includes('probation_maximum_months')) throw mapRegulationMutationError(update.error.message)
  }
}

export async function updateDefaultEmploymentCountry(countryCode: string): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.from('administration_hr_settings')
    .update({ default_employment_country_code: countryCode })
    .eq('tenant_id', context.tenantId).eq('administration_id', adminId)
  if (error) throw new EmploymentSettingsError('EMPLOYMENT_SETTINGS_UPDATE_FAILED', 500)
}

export async function setEmploymentPaymentFrequencies(codes: Array<'MONTHLY' | 'FOUR_WEEKLY'>): Promise<void> {
  if (codes.length === 0) throw new EmploymentSettingsError('PAYMENT_FREQUENCY_REQUIRED', 400)
  const context = await requirePermission('salary:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const selected = new Set(codes)
  const [monthly, fourWeekly] = await Promise.all([
    supabase.from('salary_frequencies').update({ is_active: selected.has('MONTHLY') }, { count: 'exact' }).eq('tenant_id', context.tenantId).eq('administration_id', adminId).eq('code', 'MONTHLY'),
    supabase.from('salary_frequencies').update({ is_active: selected.has('FOUR_WEEKLY') }, { count: 'exact' }).eq('tenant_id', context.tenantId).eq('administration_id', adminId).eq('code', 'FOUR_WEEKLY'),
  ])
  if (monthly.error || fourWeekly.error || monthly.count !== 1 || fourWeekly.count !== 1) throw new EmploymentSettingsError('PAYMENT_FREQUENCY_UPDATE_FAILED', 500)
}

export async function createEmploymentCatalogItem(
  catalog: EmploymentCatalog,
  input: { code: string; name: string; numericValue: number | null },
): Promise<void> {
  const context = await requirePermission(catalog === 'SALARY_FREQUENCY' ? 'salary:write' : 'contract:write')
  const adminId = administrationId(context.administrationId)
  const groupId = requireHrGroupId(context)
  const supabase = await createClient()
  const scope = { tenant_id: context.tenantId, administration_id: adminId, code: input.code, name: input.name }
  const result = catalog === 'LABOR_CONDITION_SET'
    ? await supabase.from('labor_condition_sets').insert({ ...scope, hr_group_id: groupId, standard_hours_per_week: input.numericValue ?? 40 })
    : catalog === 'FLEX_PHASE'
      ? await supabase.from('flex_phases').insert({ ...scope, sort_order: input.numericValue ?? 0 })
      : catalog === 'SALARY_FREQUENCY'
        ? await supabase.from('salary_frequencies').insert({ ...scope, periods_per_year: input.numericValue ?? 12 })
    : catalog === 'COST_CARRIER' ? await supabase.from('cost_carriers').insert(scope) : await supabase.from('cost_centers').insert(scope)
  if (result.error?.code === '23505') throw new EmploymentSettingsError('CATALOG_CODE_CONFLICT', 409)
  if (result.error) throw new EmploymentSettingsError('CATALOG_CREATE_FAILED', 500)
}

export async function setEmploymentCatalogItemActive(
  catalog: EmploymentCatalog,
  id: string,
  isActive: boolean,
): Promise<void> {
  const context = await requirePermission(catalog === 'SALARY_FREQUENCY' ? 'salary:write' : 'contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const result = catalog === 'LABOR_CONDITION_SET'
    ? await supabase.from('labor_condition_sets').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId)
    : catalog === 'FLEX_PHASE'
      ? await supabase.from('flex_phases').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId)
      : catalog === 'SALARY_FREQUENCY'
        ? await supabase.from('salary_frequencies').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId)
        : catalog === 'COST_CARRIER' ? await supabase.from('cost_carriers').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId) : await supabase.from('cost_centers').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId)
  if (result.error) throw new EmploymentSettingsError('CATALOG_UPDATE_FAILED', 500)
  if (!result.count) throw new EmploymentSettingsError('CATALOG_NOT_FOUND', 404)
}

export async function updateEmploymentCatalogItem(catalog: EmploymentCatalog, id: string, input: { code: string; name: string; numericValue: number | null }): Promise<void> {
  const context = await requirePermission(catalog === 'SALARY_FREQUENCY' ? 'salary:write' : 'contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const fields = { code: input.code, name: input.name }
  const result = catalog === 'LABOR_CONDITION_SET'
    ? await supabase.from('labor_condition_sets').update({ ...fields, standard_hours_per_week: input.numericValue ?? 40 }, { count: 'exact' }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
    : catalog === 'FLEX_PHASE'
      ? await supabase.from('flex_phases').update({ ...fields, sort_order: input.numericValue ?? 0 }, { count: 'exact' }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
      : catalog === 'SALARY_FREQUENCY'
        ? await supabase.from('salary_frequencies').update({ ...fields, periods_per_year: input.numericValue ?? 12 }, { count: 'exact' }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
        : catalog === 'COST_CARRIER'
          ? await supabase.from('cost_carriers').update(fields, { count: 'exact' }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
          : await supabase.from('cost_centers').update(fields, { count: 'exact' }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
  if (result.error?.code === '23505') throw new EmploymentSettingsError('CATALOG_CODE_CONFLICT', 409)
  if (result.error) throw new EmploymentSettingsError('CATALOG_UPDATE_FAILED', 500)
  if (!result.count) throw new EmploymentSettingsError('CATALOG_NOT_FOUND', 404)
}
