import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PayrollImportClient } from '../database'
import { payrollImportIncomeSourceRef } from '../source-reference'
import type { PayrollFinalizationAction } from './planner'
import type {
  Control02FinalizationClient,
  PayrollImportFinalizationActionRow,
} from './ledger-database'

type WriterScope = {
  tenantId: string
  hrGroupId: string
  administrationId: string
  batchId: string
  actorUserId: string
}

type CompletedAction = Pick<PayrollImportFinalizationActionRow,
  'action_type' | 'target_employee_ref' | 'target_employment_ref' | 'checkpoint' | 'status'>

type TransactionalWriterInput = WriterScope & {
  importPersonId: string
  action: PayrollFinalizationAction
  leaseOwner: string
  leaseTokenHash: string
  completedActions: readonly CompletedAction[]
}

type CoreVersionRow = { id: string; updated_at: string }

function clients(): { staging: PayrollImportClient; finalization: Control02FinalizationClient } {
  const admin = createAdminClient()
  return {
    staging: admin as unknown as PayrollImportClient,
    finalization: admin as unknown as Control02FinalizationClient,
  }
}

function databaseFailure(error: { code?: string; message?: string } | null, fallback: string): never {
  const message = error?.message ?? ''
  const code = message.match(/PAYROLL_FINALIZATION_[A-Z0-9_.:-]+/)?.[0]
    ?? message.match(/PAYROLL_IMPORT_[A-Z0-9_.:-]+/)?.[0]
    ?? fallback
  const failure = new Error(code)
  failure.name = 'PayrollFinalizationWriterError'
  throw failure
}

function checkpointId(value: unknown, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate) ? candidate : null
}

function resolvedTargetEmployeeId(
  action: PayrollFinalizationAction,
  completedActions: readonly CompletedAction[],
): string | null {
  if (action.targetEmployeeId) return action.targetEmployeeId
  if (!action.targetEmployeeRef) return null
  const prior = completedActions.find((candidate) => candidate.status === 'COMPLETED'
    && candidate.action_type === 'CREATE_EMPLOYEE'
    && candidate.target_employee_ref === action.targetEmployeeRef)
  return prior ? checkpointId(prior.checkpoint, 'createdEmployeeId') : null
}

function resolvedTargetEmploymentId(
  action: PayrollFinalizationAction,
  completedActions: readonly CompletedAction[],
): string | null {
  if (action.targetEmploymentId) return action.targetEmploymentId
  if (!action.targetEmploymentRef) return null
  const prior = completedActions.find((candidate) => candidate.status === 'COMPLETED'
    && candidate.action_type === 'CREATE_DRAFT_EMPLOYMENT'
    && candidate.target_employment_ref === action.targetEmploymentRef)
  return prior ? checkpointId(prior.checkpoint, 'createdEmploymentId') : null
}

function versionMaterial(versions: Readonly<Record<string, string>>): string {
  return Object.entries(versions)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

async function addCoreVersion(
  versions: Record<string, string>,
  table: 'employees' | 'employments' | 'income_relationships',
  keyPrefix: string,
  id: string | null,
  scope: WriterScope,
  targetEmployeeId: string | null,
): Promise<void> {
  if (!id) return
  const { finalization } = clients()
  let row: CoreVersionRow | null = null
  if (table === 'employees') {
    const result = await finalization.from('employees')
      .select('id,updated_at')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (result.error || !result.data) databaseFailure(result.error, 'PAYROLL_FINALIZATION_CORE_STATE_READ_FAILED')
    row = result.data
  } else if (table === 'employments') {
    const result = await finalization.from('employments')
      .select('id,updated_at')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .eq('administration_id', scope.administrationId)
      .eq('employee_id', targetEmployeeId ?? '')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (result.error || !result.data) databaseFailure(result.error, 'PAYROLL_FINALIZATION_CORE_STATE_READ_FAILED')
    row = result.data
  } else {
    const result = await finalization.from('income_relationships')
      .select('id,updated_at')
      .eq('tenant_id', scope.tenantId)
      .eq('administration_id', scope.administrationId)
      .eq('employee_id', targetEmployeeId ?? '')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (result.error || !result.data) databaseFailure(result.error, 'PAYROLL_FINALIZATION_CORE_STATE_READ_FAILED')
    row = result.data
  }
  if (!row) databaseFailure(null, 'PAYROLL_FINALIZATION_CORE_STATE_READ_FAILED')
  versions[`${keyPrefix}:${id}`] = row.updated_at
}

export async function executeTransactionalPayrollFinalizationAction(
  input: TransactionalWriterInput,
): Promise<{ actionId: string; status: 'COMPLETED'; planStatus: 'IN_PROGRESS' | 'COMPLETED'; readbackHash: string }> {
  const { staging, finalization } = clients()
  const personResult = await staging.from('payroll_import_persons')
    .select('id,source_row_number,updated_at')
    .eq('id', input.importPersonId)
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('batch_id', input.batchId)
    .maybeSingle()
  if (personResult.error || !personResult.data) databaseFailure(personResult.error, 'PAYROLL_FINALIZATION_SOURCE_PERSON_READ_FAILED')
  const person = personResult.data
  const personRef = `row-${person.source_row_number}`
  if (input.action.sourcePersonRef !== personRef) {
    throw new Error('PAYROLL_FINALIZATION_SOURCE_PERSON_REFERENCE_MISMATCH')
  }

  const incomeResult = await staging.from('payroll_import_income_relationships')
    .select('id,payroll_tax_number,ikv_number,starts_on,ends_on,updated_at')
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('administration_id', input.administrationId)
    .eq('batch_id', input.batchId)
    .eq('import_person_id', input.importPersonId)
    .order('id', { ascending: true })
  if (incomeResult.error || !incomeResult.data) databaseFailure(incomeResult.error, 'PAYROLL_FINALIZATION_SOURCE_INCOME_READ_FAILED')
  const sourceRefs = incomeResult.data.map((income) => ({
    sourceRef: payrollImportIncomeSourceRef({
      sourcePersonRef: personRef,
      payrollTaxNumber: income.payroll_tax_number,
      ikvNumber: income.ikv_number,
      startsOn: income.starts_on,
      endsOn: income.ends_on,
    }),
    updatedAt: income.updated_at,
  }))

  const expectedVersions: Record<string, string> = {
    [`person:${person.id}`]: person.updated_at,
  }
  for (const sourceRef of input.action.sourceRefs) {
    if (sourceRef === personRef) continue
    const source = sourceRefs.find((candidate) => candidate.sourceRef === sourceRef)
    if (!source) throw new Error('PAYROLL_FINALIZATION_SOURCE_INCOME_REFERENCE_MISMATCH')
    expectedVersions[`source:${sourceRef}`] = source.updatedAt
  }

  const targetEmployeeId = resolvedTargetEmployeeId(input.action, input.completedActions)
  const targetEmploymentId = resolvedTargetEmploymentId(input.action, input.completedActions)
  if (input.action.type !== 'CREATE_EMPLOYEE') {
    await addCoreVersion(expectedVersions, 'employees', 'employee', targetEmployeeId, input, targetEmployeeId)
  }
  if (input.action.type !== 'CREATE_DRAFT_EMPLOYMENT') {
    await addCoreVersion(expectedVersions, 'employments', 'employment', targetEmploymentId, input, targetEmployeeId)
  }
  if (input.action.targetIncomeRelationshipId) {
    await addCoreVersion(expectedVersions, 'income_relationships', 'income', input.action.targetIncomeRelationshipId, input, targetEmployeeId)
  }

  if (input.action.type === 'CREATE_INCOME_RELATIONSHIP') {
    const sourceIncome = input.action.sourceIncomeRef
      ? incomeResult.data.find((_, index) => sourceRefs[index]?.sourceRef === input.action.sourceIncomeRef)
      : undefined
    if (!sourceIncome || !input.action.sourcePayrollTaxNumber || !input.action.sourceStartsOn) {
      throw new Error('PAYROLL_FINALIZATION_TAX_BINDING_SCOPE_OR_PERIOD_INVALID')
    }
    const sourceEndsOn = input.action.sourceEndsOn ?? null
    const bindingResult = await staging.from('administration_payroll_tax_numbers')
      .select('id,valid_from,valid_until,updated_at')
      .eq('tenant_id', input.tenantId)
      .eq('hr_group_id', input.hrGroupId)
      .eq('administration_id', input.administrationId)
      .eq('payroll_tax_number', input.action.sourcePayrollTaxNumber)
      .lte('valid_from', input.action.sourceStartsOn)
      .order('valid_from', { ascending: false })
    if (bindingResult.error || !bindingResult.data) databaseFailure(bindingResult.error, 'PAYROLL_FINALIZATION_TAX_BINDING_READ_FAILED')
    const binding = bindingResult.data.find((candidate) => candidate.valid_until === null
      || (sourceEndsOn !== null && candidate.valid_until >= sourceEndsOn))
    if (!binding) throw new Error('PAYROLL_FINALIZATION_TAX_BINDING_SCOPE_OR_PERIOD_INVALID')
    expectedVersions[`binding:${binding.id}`] = binding.updated_at
  }

  const material = versionMaterial(expectedVersions)
  const stateToken = createHash('sha256').update(material, 'utf8').digest('hex')
  const result = await finalization.rpc('execute_control02_test_payroll_finalization_action', {
    requested_tenant_id: input.tenantId,
    requested_hr_group_id: input.hrGroupId,
    requested_batch_id: input.batchId,
    requested_action_id: input.action.actionId,
    requested_actor_user_id: input.actorUserId,
    requested_lease_owner: input.leaseOwner,
    requested_lease_token_hash: input.leaseTokenHash,
    requested_expected_versions: expectedVersions,
    requested_state_token: stateToken,
  })
  if (result.error) databaseFailure(result.error, 'PAYROLL_FINALIZATION_ACTION_WRITE_FAILED')
  if (result.data === null || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new Error('PAYROLL_FINALIZATION_ACTION_READBACK_FAILED')
  }
  const payload = result.data as Record<string, unknown>
  if (payload.actionId !== input.action.actionId
    || payload.status !== 'COMPLETED'
    || (payload.planStatus !== 'IN_PROGRESS' && payload.planStatus !== 'COMPLETED')
    || typeof payload.readbackHash !== 'string'
    || !/^[0-9a-f]{64}$/.test(payload.readbackHash)) {
    throw new Error('PAYROLL_FINALIZATION_ACTION_READBACK_FAILED')
  }
  return {
    actionId: payload.actionId,
    status: 'COMPLETED',
    planStatus: payload.planStatus,
    readbackHash: payload.readbackHash,
  }
}
