import 'server-only'

import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EmploymentCatalog = 'LABOR_CONDITION_SET' | 'FLEX_PHASE' | 'SALARY_FREQUENCY' | 'COST_CARRIER'

export class EmploymentSettingsError extends Error {
  constructor(readonly code: string, readonly status: 400 | 404 | 409 | 500) {
    super(code)
  }
}

function administrationId(value: string | null): string {
  if (!value) throw new EmploymentSettingsError('ADMINISTRATION_REQUIRED', 400)
  return value
}

export async function getEmploymentSettings() {
  const context = await requirePermission('contract:read')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const [settings, labor, flex, frequencies, carriers] = await Promise.all([
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
  ])
  if ([settings, labor, flex, frequencies, carriers].some((result) => result.error) || !settings.data) {
    throw new EmploymentSettingsError('EMPLOYMENT_SETTINGS_READ_FAILED', 500)
  }
  return {
    defaultCountryCode: settings.data.default_employment_country_code,
    laborConditionSets: labor.data ?? [],
    flexPhases: flex.data ?? [],
    salaryFrequencies: frequencies.data ?? [],
    costCarriers: carriers.data ?? [],
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

export async function createEmploymentCatalogItem(
  catalog: EmploymentCatalog,
  input: { code: string; name: string; numericValue: number | null },
): Promise<void> {
  const context = await requirePermission(catalog === 'SALARY_FREQUENCY' ? 'salary:write' : 'contract:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const scope = { tenant_id: context.tenantId, administration_id: adminId, code: input.code, name: input.name }
  const result = catalog === 'LABOR_CONDITION_SET'
    ? await supabase.from('labor_condition_sets').insert({ ...scope, standard_hours_per_week: input.numericValue ?? 40 })
    : catalog === 'FLEX_PHASE'
      ? await supabase.from('flex_phases').insert({ ...scope, sort_order: input.numericValue ?? 0 })
      : catalog === 'SALARY_FREQUENCY'
        ? await supabase.from('salary_frequencies').insert({ ...scope, periods_per_year: input.numericValue ?? 12 })
        : await supabase.from('cost_carriers').insert(scope)
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
        : await supabase.from('cost_carriers').update({ is_active: isActive }, { count: 'exact' }).eq('id', id).eq('administration_id', adminId)
  if (result.error) throw new EmploymentSettingsError('CATALOG_UPDATE_FAILED', 500)
  if (!result.count) throw new EmploymentSettingsError('CATALOG_NOT_FOUND', 404)
}
