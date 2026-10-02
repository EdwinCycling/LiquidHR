import 'server-only'

import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import type {
  PayrollCustomerComponentVersionRow,
  PayrollDatabase,
  PayrollJson,
} from './database'
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

type ComponentDraftInsert = PayrollDatabase['public']['Tables']['customer_component_versions']['Insert']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUSTOMER_CODE_PATTERN = /^CUSTOM_[A-F0-9]{32}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/
const SAFE_METHODS = new Set(['source', 'passThrough', 'expression', 'aggregate'])

export interface ComponentDraftRepository {
  list(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollCustomerComponentVersionRow[]>
  get(scope: PayrollScope, payrollAdministrationId: string, draftRowId: string): Promise<PayrollCustomerComponentVersionRow | null>
  insert(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: ComponentDraftInsert,
  ): Promise<PayrollCustomerComponentVersionRow>
}

export class ComponentDraftRepositoryError extends Error {
  constructor(readonly code = 'PAYROLL_COMPONENT_DRAFT_REPOSITORY_FAILURE') {
    super('Payroll Lab component draft data could not be read or written.')
    this.name = 'ComponentDraftRepositoryError'
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new ComponentDraftRepositoryError()
}

function isRecord(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringField(record: { readonly [key: string]: PayrollJson | undefined }, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function sameTimestamp(left: string, right: string): boolean {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  return Number.isFinite(leftTime) && leftTime === rightTime
}

function assertDefinitionMatchesRow(row: ComponentDraftInsert): void {
  const definition = row.definition_json
  const catalogMetadata = row.catalog_metadata_json
  if (!isRecord(definition) || !isRecord(definition.ownership) || !isRecord(definition.method)
    || !isRecord(catalogMetadata) || !isRecord(catalogMetadata.package)
    || !isRecord(catalogMetadata.sourceCatalogGraph) || catalogMetadata.snapshotOnly !== true) {
    throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_INVALID')
  }

  if (
    row.status !== 'DRAFT'
    || !['CUSTOMER_FORK', 'CUSTOMER_CUSTOM'].includes(row.ownership)
    || !CUSTOMER_CODE_PATTERN.test(row.component_code)
    || row.component_id !== row.component_code
    || definition.id !== row.component_id
    || definition.code !== row.component_code
    || definition.version !== row.component_version
    || definition.effectiveFrom !== row.effective_from
    || definition.effectiveTo !== row.effective_to
    || stringField(definition.ownership, 'kind') !== row.ownership
    || !SAFE_METHODS.has(stringField(definition.method, 'kind') ?? '')
    || (row.ownership === 'CUSTOMER_FORK'
      && stringField(catalogMetadata.package, 'compositionId') !== row.origin_composition_id)
    || (row.ownership === 'CUSTOMER_CUSTOM'
      && !stringField(catalogMetadata.package, 'compositionId')?.trim())
    || !HASH_PATTERN.test(row.definition_hash)
    || sha256(stableSerialize(definition)) !== row.definition_hash
  ) {
    throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_INVALID')
  }

  const origin = definition.ownership.origin
  if (row.ownership === 'CUSTOMER_FORK') {
    if (!isRecord(origin)
      || stringField(origin, 'id') !== row.origin_component_id
      || stringField(origin, 'code') !== row.origin_component_code
      || stringField(origin, 'version') !== row.origin_component_version
      || typeof definition.ownership.forkedAt !== 'string'
      || row.forked_at === null
      || !sameTimestamp(definition.ownership.forkedAt, row.forked_at)
      || !row.origin_component_id
      || !row.origin_component_code
      || !row.origin_component_version
      || !row.origin_composition_id
      || stringField(catalogMetadata.package, 'packageId') !== row.origin_package_id
      || stringField(catalogMetadata.package, 'version') !== row.origin_package_version
      || stringField(catalogMetadata.package, 'packageHash') !== row.origin_package_hash
      || row.component_id === row.origin_component_id
      || row.component_code === row.origin_component_code) {
      throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_INVALID')
    }
  } else if (
    origin !== undefined
    || definition.ownership.forkedAt !== undefined
    || row.origin_component_id !== null
    || row.origin_component_code !== null
    || row.origin_component_version !== null
    || row.origin_composition_id !== null
    || row.origin_package_id !== null
    || row.origin_package_version !== null
    || row.origin_package_hash !== null
    || row.forked_at !== null
  ) {
    throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_INVALID')
  }

  if (row.origin_package_hash !== null && !HASH_PATTERN.test(row.origin_package_hash)) {
    throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_INVALID')
  }
}

function assertScopedInsert(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: ComponentDraftInsert,
): void {
  const validatedScope = assertPayrollScope(scope)
  assertUuid(payrollAdministrationId)
  assertUuid(row.created_by_user_id)
  if (
    row.payroll_administration_id !== payrollAdministrationId
    || row.source_tenant_id !== validatedScope.tenantId
    || row.source_hr_group_id !== validatedScope.hrGroupId
    || row.source_administration_id !== validatedScope.administrationId
  ) {
    throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_SCOPE_MISMATCH')
  }
  assertDefinitionMatchesRow(row)
}

function throwOnError(error: unknown): void {
  if (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new ComponentDraftRepositoryError('PAYROLL_COMPONENT_DRAFT_ALREADY_EXISTS')
    }
    throw new ComponentDraftRepositoryError()
  }
}

class SupabaseComponentDraftRepository implements ComponentDraftRepository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async list(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollCustomerComponentVersionRow[]> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('customer_component_versions').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .order('created_at', { ascending: false }),
      validatedScope,
    )

    throwOnError(error)
    return data ?? []
  }

  async get(
    scope: PayrollScope,
    payrollAdministrationId: string,
    draftRowId: string,
  ): Promise<PayrollCustomerComponentVersionRow | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(draftRowId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('customer_component_versions').select('*')
        .eq('id', draftRowId)
        .eq('payroll_administration_id', payrollAdministrationId),
      validatedScope,
    ).maybeSingle()

    throwOnError(error)
    return data
  }

  async insert(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: ComponentDraftInsert,
  ): Promise<PayrollCustomerComponentVersionRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('customer_component_versions').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new ComponentDraftRepositoryError()
    return data
  }
}

export function createComponentDraftRepository(
  client: PayrollSupabaseClient = createPayrollSupabaseClient(),
): ComponentDraftRepository {
  return new SupabaseComponentDraftRepository(client)
}
