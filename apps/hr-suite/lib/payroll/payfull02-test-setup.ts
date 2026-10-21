import 'server-only'

import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import {
  getPayrollAcceptanceScenarioSetupDefinition,
  type PersistedPayrollAcceptanceScenarioSetup,
} from './payroll-acceptance-scenario'
import type { PayrollJson } from './database'
import {
  type Payrun01Repository,
  type Payrun01CalculationConfigVersionInput,
  type Payrun01OpeningCumulativeInput,
} from './payrun01-repository'
import { isLocalPayrollAcceptanceScope } from './local-payroll-acceptance-runtime'
import type { PayrollScope } from './scope'

const TEST_SETUP_SOURCE = 'TEST_SETUP_PAYFULL_02'

export class Payfull02TestSetupError extends Error {
  constructor(readonly code: 'PAYFULL02_TEST_SETUP_SCOPE_FORBIDDEN' | 'PAYFULL02_TEST_SETUP_VERSION_CONFLICT') {
    super(code)
    this.name = 'Payfull02TestSetupError'
  }
}

function payrollJson(value: unknown): PayrollJson {
  return JSON.parse(stableSerialize(value)) as PayrollJson
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right)
}

function scopeColumns(scope: PayrollScope, payrollAdministrationId: string) {
  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
  }
}

export async function ensurePayfull02TestSetup(input: {
  readonly repository: Payrun01Repository
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly actorUserId: string
  readonly employeeId: string
  readonly employmentId: string
  readonly januaryThroughSeptemberSourceSnapshots: readonly PayrollSourceSnapshot[]
}): Promise<PersistedPayrollAcceptanceScenarioSetup> {
  const {
    repository, scope, payrollAdministrationId, actorUserId, employeeId, employmentId,
    januaryThroughSeptemberSourceSnapshots,
  } = input
  if (!isLocalPayrollAcceptanceScope(scope, payrollAdministrationId)) {
    throw new Payfull02TestSetupError('PAYFULL02_TEST_SETUP_SCOPE_FORBIDDEN')
  }

  const definition = getPayrollAcceptanceScenarioSetupDefinition(employeeId, employmentId, januaryThroughSeptemberSourceSnapshots)
  const configJson = payrollJson(definition.configJson) as Exclude<PayrollJson, null>
  const configHash = sha256(stableSerialize(configJson))
  const configInput: Payrun01CalculationConfigVersionInput = {
    ...scopeColumns(scope, payrollAdministrationId),
    source_employment_id: employmentId,
    config_version: definition.configVersion,
    effective_from: definition.effectiveFrom,
    effective_to: definition.effectiveTo,
    config_json: configJson,
    config_hash: configHash,
    provenance_status: 'TEST_ONLY',
    provenance_source: TEST_SETUP_SOURCE,
    created_by_user_id: actorUserId,
  }
  const configRow = await repository.getOrCreateCalculationConfigVersion(scope, payrollAdministrationId, configInput)
  if (configRow.config_hash !== configHash
    || configRow.effective_from !== definition.effectiveFrom
    || configRow.effective_to !== definition.effectiveTo
    || configRow.provenance_source !== TEST_SETUP_SOURCE
    || !sameCanonical(configRow.config_json, configJson)) {
    throw new Payfull02TestSetupError('PAYFULL02_TEST_SETUP_VERSION_CONFLICT')
  }

  const openingBalanceJson = payrollJson(definition.openingBalanceJson) as Exclude<PayrollJson, null>
  const openingHash = sha256(stableSerialize(openingBalanceJson))
  const openingInput: Payrun01OpeningCumulativeInput = {
    ...scopeColumns(scope, payrollAdministrationId),
    source_employment_id: employmentId,
    snapshot_version: definition.openingSnapshotVersion,
    as_of_date: definition.openingAsOfDate,
    opening_balance_json: openingBalanceJson,
    snapshot_hash: openingHash,
    provenance_status: 'TEST_OPENING_BALANCE',
    provenance_source: TEST_SETUP_SOURCE,
    created_by_user_id: actorUserId,
  }
  const openingRow = await repository.getOrCreateOpeningCumulativeSnapshot(scope, payrollAdministrationId, openingInput)
  if (openingRow.snapshot_hash !== openingHash
    || openingRow.as_of_date !== definition.openingAsOfDate
    || openingRow.provenance_source !== TEST_SETUP_SOURCE
    || !sameCanonical(openingRow.opening_balance_json, openingBalanceJson)) {
    throw new Payfull02TestSetupError('PAYFULL02_TEST_SETUP_VERSION_CONFLICT')
  }

  return {
    configVersionId: configRow.id,
    configHash: configRow.config_hash,
    configJson: definition.configJson,
    openingSnapshotId: openingRow.id,
    openingHash: openingRow.snapshot_hash,
    openingBalanceJson: definition.openingBalanceJson,
  }
}

export async function readPayfull02TestSetup(input: {
  readonly repository: Payrun01Repository
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly employeeId: string
  readonly employmentId: string
  readonly januaryThroughSeptemberSourceSnapshots: readonly PayrollSourceSnapshot[]
}): Promise<PersistedPayrollAcceptanceScenarioSetup | null> {
  const {
    repository, scope, payrollAdministrationId, employeeId, employmentId,
    januaryThroughSeptemberSourceSnapshots,
  } = input
  if (!isLocalPayrollAcceptanceScope(scope, payrollAdministrationId)) {
    throw new Payfull02TestSetupError('PAYFULL02_TEST_SETUP_SCOPE_FORBIDDEN')
  }

  const definition = getPayrollAcceptanceScenarioSetupDefinition(employeeId, employmentId, januaryThroughSeptemberSourceSnapshots)
  const [configRow, openingRow] = await Promise.all([
    repository.getCalculationConfigVersion(scope, payrollAdministrationId, employmentId, definition.configVersion),
    repository.getOpeningCumulativeSnapshot(scope, payrollAdministrationId, employmentId, definition.openingSnapshotVersion),
  ])
  if (!configRow || !openingRow) return null

  const configJson = payrollJson(definition.configJson)
  const openingBalanceJson = payrollJson(definition.openingBalanceJson)
  if (configRow.config_hash !== sha256(stableSerialize(configJson))
    || openingRow.snapshot_hash !== sha256(stableSerialize(openingBalanceJson))
    || configRow.provenance_source !== TEST_SETUP_SOURCE
    || openingRow.provenance_source !== TEST_SETUP_SOURCE
    || !sameCanonical(configRow.config_json, configJson)
    || !sameCanonical(openingRow.opening_balance_json, openingBalanceJson)) {
    throw new Payfull02TestSetupError('PAYFULL02_TEST_SETUP_VERSION_CONFLICT')
  }

  return {
    configVersionId: configRow.id,
    configHash: configRow.config_hash,
    configJson: definition.configJson,
    openingSnapshotId: openingRow.id,
    openingHash: openingRow.snapshot_hash,
    openingBalanceJson: definition.openingBalanceJson,
  }
}
