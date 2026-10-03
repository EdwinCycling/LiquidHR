import 'server-only'

import type {
  PayrollArrangementAssignmentRow,
  PayrollArrangementAvailabilityRow,
  PayrollArrangementCompositionSnapshotRow,
  PayrollDatabase,
} from './database'
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

type AvailabilityInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_availability']['Insert']
type AssignmentInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_assignments']['Insert']
type CompositionSnapshotInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_composition_snapshots']['Insert']

export interface ArrangementRepository {
  listAvailability(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollArrangementAvailabilityRow[]>
  insertAvailability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: AvailabilityInsert,
  ): Promise<PayrollArrangementAvailabilityRow>
  endAvailability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    packageId: string,
    effectiveTo: string,
    updatedAt: string,
    updatedByUserId: string,
  ): Promise<PayrollArrangementAvailabilityRow>
  listAssignments(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollArrangementAssignmentRow[]>
  insertAssignment(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: AssignmentInsert,
  ): Promise<PayrollArrangementAssignmentRow>
  listCompositionSnapshots(
    scope: PayrollScope,
    payrollAdministrationId: string,
  ): Promise<readonly PayrollArrangementCompositionSnapshotRow[]>
  findCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentId: string,
    asOfDate: string,
    snapshotHash: string,
  ): Promise<PayrollArrangementCompositionSnapshotRow | null>
  insertCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: CompositionSnapshotInsert,
  ): Promise<PayrollArrangementCompositionSnapshotRow>
}

export class ArrangementRepositoryError extends Error {
  constructor(readonly code = 'ARRANGEMENT_REPOSITORY_FAILURE') {
    super('Payroll Lab arrangement data could not be read or written.')
    this.name = 'ArrangementRepositoryError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new ArrangementRepositoryError('ARRANGEMENT_SCOPE_INVALID')
}

function assertRowScope(scope: PayrollScope, payrollAdministrationId: string, row: {
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  created_by_user_id: string | null
}): void {
  const checkedScope = assertPayrollScope(scope)
  assertUuid(payrollAdministrationId)
  if (!row.created_by_user_id) throw new ArrangementRepositoryError('ARRANGEMENT_ACTOR_INVALID')
  assertUuid(row.created_by_user_id)
  if (row.payroll_administration_id !== payrollAdministrationId
    || row.source_tenant_id !== checkedScope.tenantId
    || row.source_hr_group_id !== checkedScope.hrGroupId
    || row.source_administration_id !== checkedScope.administrationId) {
    throw new ArrangementRepositoryError('ARRANGEMENT_SCOPE_MISMATCH')
  }
}

function throwOnError(error: unknown, conflictCode?: string): void {
  if (!error) return
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    if (code === '23505' && conflictCode) throw new ArrangementRepositoryError(conflictCode)
    if (code === '23503') throw new ArrangementRepositoryError('ARRANGEMENT_NOT_AVAILABLE')
  }
  throw new ArrangementRepositoryError()
}

class SupabaseArrangementRepository implements ArrangementRepository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async listAvailability(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollArrangementAvailabilityRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_arrangement_availability').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .order('package_id', { ascending: true }),
      checkedScope,
    )
    throwOnError(error)
    return data ?? []
  }

  async insertAvailability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: AvailabilityInsert,
  ): Promise<PayrollArrangementAvailabilityRow> {
    assertRowScope(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('payroll_arrangement_availability').insert(row).select('*').single()
    throwOnError(error, 'ARRANGEMENT_AVAILABILITY_ALREADY_EXISTS')
    if (!data) throw new ArrangementRepositoryError()
    return data
  }

  async endAvailability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    packageId: string,
    effectiveTo: string,
    updatedAt: string,
    updatedByUserId: string,
  ): Promise<PayrollArrangementAvailabilityRow> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(updatedByUserId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_arrangement_availability')
        .update({ effective_to: effectiveTo, updated_at: updatedAt, updated_by_user_id: updatedByUserId })
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('package_id', packageId),
      checkedScope,
    ).select('*').single()
    throwOnError(error)
    if (!data) throw new ArrangementRepositoryError()
    return data
  }

  async listAssignments(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollArrangementAssignmentRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_arrangement_assignments').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .order('fixture_code', { ascending: true }),
      checkedScope,
    )
    throwOnError(error)
    return data ?? []
  }

  async insertAssignment(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: AssignmentInsert,
  ): Promise<PayrollArrangementAssignmentRow> {
    assertRowScope(scope, payrollAdministrationId, row)
    assertUuid(row.source_employment_id)
    const { data, error } = await this.client.from('payroll_arrangement_assignments').insert(row).select('*').single()
    throwOnError(error, 'ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS')
    if (!data) throw new ArrangementRepositoryError()
    return data
  }

  async listCompositionSnapshots(
    scope: PayrollScope,
    payrollAdministrationId: string,
  ): Promise<readonly PayrollArrangementCompositionSnapshotRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_arrangement_composition_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .order('created_at', { ascending: false })
        .limit(50),
      checkedScope,
    )
    throwOnError(error)
    return data ?? []
  }

  async findCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentId: string,
    asOfDate: string,
    snapshotHash: string,
  ): Promise<PayrollArrangementCompositionSnapshotRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(assignmentId)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_arrangement_composition_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('assignment_id', assignmentId)
        .eq('as_of_date', asOfDate)
        .eq('snapshot_hash', snapshotHash),
      checkedScope,
    ).maybeSingle()
    throwOnError(error)
    return data
  }

  async insertCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: CompositionSnapshotInsert,
  ): Promise<PayrollArrangementCompositionSnapshotRow> {
    assertRowScope(scope, payrollAdministrationId, row)
    assertUuid(row.source_employment_id)
    assertUuid(row.assignment_id)
    const { data, error } = await this.client.from('payroll_arrangement_composition_snapshots').insert(row).select('*').single()
    throwOnError(error, 'ARRANGEMENT_SNAPSHOT_ALREADY_EXISTS')
    if (!data) throw new ArrangementRepositoryError()
    return data
  }
}

export function createArrangementRepository(
  client: PayrollSupabaseClient = createPayrollSupabaseClient(),
): ArrangementRepository {
  return new SupabaseArrangementRepository(client)
}
