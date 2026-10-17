import 'server-only'

import type {
  PayrollDatabase,
  PayrollEmployerConfigurationVersionRow,
  PayrollOpeningCumulativeSnapshotRow,
} from './database'
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

type ConfigurationInsert = PayrollDatabase['public']['Tables']['payroll_employer_configuration_versions']['Insert']
type OpeningInsert = PayrollDatabase['public']['Tables']['payroll_opening_cumulative_snapshots']['Insert']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/

export interface PayrollSetupRepository {
  listEmployerConfigurations(
    scope: PayrollScope,
    payrollAdministrationId: string,
  ): Promise<readonly PayrollEmployerConfigurationVersionRow[]>
  getEffectiveEmployerConfiguration(
    scope: PayrollScope,
    payrollAdministrationId: string,
    asOfDate: string,
  ): Promise<PayrollEmployerConfigurationVersionRow | null>
  insertEmployerConfiguration(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: ConfigurationInsert,
  ): Promise<PayrollEmployerConfigurationVersionRow>
  listOpeningCumulativeSnapshots(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId?: string,
  ): Promise<readonly PayrollOpeningCumulativeSnapshotRow[]>
  insertOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: OpeningInsert,
  ): Promise<PayrollOpeningCumulativeSnapshotRow>
}

export class PayrollSetupRepositoryError extends Error {
  constructor(readonly code = 'PAYROLL_SETUP_REPOSITORY_FAILURE') {
    super('Payroll setup data could not be read or written.')
    this.name = 'PayrollSetupRepositoryError'
  }
}

function assertUuid(value: string, code = 'PAYROLL_SETUP_SCOPE_INVALID'): void {
  if (!UUID_PATTERN.test(value)) throw new PayrollSetupRepositoryError(code)
}

function assertScopeRow(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: {
    payroll_administration_id: string
    source_tenant_id: string
    source_hr_group_id: string
    source_administration_id: string
    created_by_user_id: string | null
  },
): void {
  const checkedScope = assertPayrollScope(scope)
  assertUuid(payrollAdministrationId)
  if (!row.created_by_user_id) throw new PayrollSetupRepositoryError('PAYROLL_SETUP_ACTOR_INVALID')
  assertUuid(row.created_by_user_id, 'PAYROLL_SETUP_ACTOR_INVALID')
  if (row.payroll_administration_id !== payrollAdministrationId
    || row.source_tenant_id !== checkedScope.tenantId
    || row.source_hr_group_id !== checkedScope.hrGroupId
    || row.source_administration_id !== checkedScope.administrationId) {
    throw new PayrollSetupRepositoryError('PAYROLL_SETUP_SCOPE_MISMATCH')
  }
}

function throwOnError(error: unknown, conflictCode?: string): void {
  if (!error) return
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    if (code === '23505' && conflictCode) throw new PayrollSetupRepositoryError(conflictCode)
    if (code === '23514') throw new PayrollSetupRepositoryError('PAYROLL_SETUP_VALIDATION_FAILED')
  }
  throw new PayrollSetupRepositoryError()
}

function assertConfigurationRow(row: ConfigurationInsert): void {
  if (!row.configuration_json || typeof row.configuration_json !== 'object' || Array.isArray(row.configuration_json)
    || row.status === undefined || !['DRAFT', 'ACTIVE'].includes(row.status)
    || !HASH_PATTERN.test(row.configuration_hash)
    || !row.source_reference.trim()) {
    throw new PayrollSetupRepositoryError('PAYROLL_SETUP_CONFIGURATION_INVALID')
  }
}

function assertOpeningRow(row: OpeningInsert): void {
  if (!row.opening_balance_json || typeof row.opening_balance_json !== 'object' || Array.isArray(row.opening_balance_json)
    || !HASH_PATTERN.test(row.snapshot_hash)
    || !['TEST_OPENING_BALANCE', 'RECONSTRUCTED_PAYROLL', 'CUSTOMER_OPENING_BALANCE'].includes(row.provenance_status)
    || !row.provenance_source.trim()) {
    throw new PayrollSetupRepositoryError('PAYROLL_SETUP_OPENING_BALANCE_INVALID')
  }
}

class SupabasePayrollSetupRepository implements PayrollSetupRepository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async listEmployerConfigurations(
    scope: PayrollScope,
    payrollAdministrationId: string,
  ): Promise<readonly PayrollEmployerConfigurationVersionRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_employer_configuration_versions').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .order('effective_from', { ascending: false })
        .order('configuration_version', { ascending: false }),
      checkedScope,
    )
    throwOnError(error)
    return data ?? []
  }

  async getEffectiveEmployerConfiguration(
    scope: PayrollScope,
    payrollAdministrationId: string,
    asOfDate: string,
  ): Promise<PayrollEmployerConfigurationVersionRow | null> {
    const rows = await this.listEmployerConfigurations(scope, payrollAdministrationId)
    return rows.find((row) => row.status === 'ACTIVE'
      && row.effective_from <= asOfDate
      && (row.effective_to === null || row.effective_to >= asOfDate)) ?? null
  }

  async insertEmployerConfiguration(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: ConfigurationInsert,
  ): Promise<PayrollEmployerConfigurationVersionRow> {
    assertScopeRow(scope, payrollAdministrationId, row)
    assertConfigurationRow(row)
    const { data, error } = await this.client.from('payroll_employer_configuration_versions').insert(row).select('*').single()
    throwOnError(error, 'PAYROLL_SETUP_CONFIGURATION_CONFLICT')
    if (!data) throw new PayrollSetupRepositoryError()
    return data
  }

  async listOpeningCumulativeSnapshots(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId?: string,
  ): Promise<readonly PayrollOpeningCumulativeSnapshotRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    if (sourceEmploymentId) assertUuid(sourceEmploymentId)
    let query = this.client.from('payroll_opening_cumulative_snapshots').select('*')
      .eq('payroll_administration_id', payrollAdministrationId)
      .order('as_of_date', { ascending: false })
      .order('snapshot_version', { ascending: false })
    if (sourceEmploymentId) query = query.eq('source_employment_id', sourceEmploymentId)
    const { data, error } = await applyPayrollScopeFilter(query, checkedScope)
    throwOnError(error)
    return data ?? []
  }

  async insertOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: OpeningInsert,
  ): Promise<PayrollOpeningCumulativeSnapshotRow> {
    assertScopeRow(scope, payrollAdministrationId, row)
    assertUuid(row.source_employment_id, 'PAYROLL_SETUP_EMPLOYMENT_INVALID')
    assertOpeningRow(row)
    const { data, error } = await this.client.from('payroll_opening_cumulative_snapshots').insert(row).select('*').single()
    throwOnError(error, 'PAYROLL_SETUP_OPENING_BALANCE_CONFLICT')
    if (!data) throw new PayrollSetupRepositoryError()
    return data
  }
}

export function createPayrollSetupRepository(client = createPayrollSupabaseClient()): PayrollSetupRepository {
  return new SupabasePayrollSetupRepository(client)
}
