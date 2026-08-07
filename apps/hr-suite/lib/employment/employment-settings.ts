import 'server-only'

import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
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
  const [settings, labor, flex, frequencies, carriers, centers] = await Promise.all([
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
  ])
  if ([settings, labor, flex, frequencies, carriers, centers].some((result) => result.error) || !settings.data) {
    throw new EmploymentSettingsError('EMPLOYMENT_SETTINGS_READ_FAILED', 500)
  }
  return {
    defaultCountryCode: settings.data.default_employment_country_code,
    laborConditionSets: labor.data ?? [],
    laborConditionTimelines: buildEmploymentRegulationTimelines(labor.data ?? []),
    flexPhases: flex.data ?? [],
    salaryFrequencies: frequencies.data ?? [],
    costCarriers: carriers.data ?? [],
    costCenters: centers.data ?? [],
  }
}

export async function createEmploymentRegulation(input: { name: string; validFrom: string; standardHoursPerWeek: number }): Promise<void> {
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
    valid_from: input.validFrom,
    predecessor_id: null,
    is_active: true,
  })
  if (result.error) throw mapRegulationMutationError(result.error.message)
}

export async function updateEmploymentRegulation(id: string, input: { name: string; validFrom: string; standardHoursPerWeek: number }): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const result = await supabase.from('labor_condition_sets').update({
    name: input.name,
    valid_from: input.validFrom,
    standard_hours_per_week: input.standardHoursPerWeek,
  }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
  if (result.error) throw mapRegulationMutationError(result.error.message)
}

export async function createEmploymentRegulationSuccessor(input: { predecessorId: string; name: string; validFrom: string; standardHoursPerWeek: number }): Promise<void> {
  const context = await requirePermission('contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_labor_condition_successor', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: adminId,
    requested_predecessor_id: input.predecessorId,
    requested_name: input.name,
    requested_valid_from: input.validFrom,
    requested_standard_hours_per_week: input.standardHoursPerWeek,
  })
  if (error) throw mapRegulationMutationError(error.message)
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
