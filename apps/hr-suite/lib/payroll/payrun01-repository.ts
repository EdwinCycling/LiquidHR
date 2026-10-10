import 'server-only'

import { createHash } from 'node:crypto'
import type {
  IndividualPayrollInputReferenceRow,
  IndividualPayrollLifecycleEventRow,
  PayrollDatabase,
  PayrollIndividualArrangementAssignmentVersionRow,
  PayrollIndividualArrangementCompositionSnapshotRow,
  PayrollIndividualArtifactRow,
  PayrollIndividualCalculationConfigVersionRow,
  PayrollOpeningCumulativeSnapshotRow,
} from './database'
import { PayrollCalculationRepositoryError } from './calculation-repository'
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

type PayrollInsert<Table extends keyof PayrollDatabase['public']['Tables']> =
  PayrollDatabase['public']['Tables'][Table]['Insert']
type ScopeColumns = {
  readonly payroll_administration_id: string
  readonly source_tenant_id: string
  readonly source_hr_group_id: string
  readonly source_administration_id: string
  readonly created_by_user_id: string | null
}

export type Payrun01AssignmentVersionInput = Omit<
  PayrollInsert<'payroll_individual_arrangement_assignment_versions'>,
  'id' | 'created_at'
>
export type Payrun01CalculationConfigVersionInput = Omit<
  PayrollInsert<'payroll_individual_calculation_config_versions'>,
  'id' | 'created_at'
>
export type Payrun01ArrangementCompositionInput = Omit<
  PayrollInsert<'payroll_individual_arrangement_composition_snapshots'>,
  'id' | 'created_at'
>
export type Payrun01OpeningCumulativeInput = Omit<
  PayrollInsert<'payroll_opening_cumulative_snapshots'>,
  'id' | 'created_at'
>
export type Payrun01InputReferenceInput = Omit<
  PayrollInsert<'individual_payroll_input_references'>,
  'id' | 'created_at'
>
export type Payrun01LifecycleEventInput = Omit<
  PayrollInsert<'individual_payroll_lifecycle_events'>,
  'id' | 'created_at'
>
export type Payrun01ArtifactMetadata = Omit<
  PayrollInsert<'payroll_individual_artifacts'>,
  'id' | 'created_at' | 'artifact_bytes' | 'artifact_hash'
>
export type Payrun01Artifact = Omit<PayrollIndividualArtifactRow, 'artifact_bytes'> & {
  readonly artifact_bytes: Uint8Array
}

export interface Payrun01Repository {
  getAssignmentVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentId: string,
    assignmentVersion: number,
  ): Promise<PayrollIndividualArrangementAssignmentVersionRow | null>
  getOrCreateAssignmentVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01AssignmentVersionInput,
  ): Promise<PayrollIndividualArrangementAssignmentVersionRow>
  getCalculationConfigVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId: string,
    configVersion: number,
  ): Promise<PayrollIndividualCalculationConfigVersionRow | null>
  getOrCreateCalculationConfigVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01CalculationConfigVersionInput,
  ): Promise<PayrollIndividualCalculationConfigVersionRow>
  getArrangementCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentVersionId: string,
    asOfDate: string,
  ): Promise<PayrollIndividualArrangementCompositionSnapshotRow | null>
  getOrCreateArrangementCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01ArrangementCompositionInput,
  ): Promise<PayrollIndividualArrangementCompositionSnapshotRow>
  getOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId: string,
    snapshotVersion: number,
  ): Promise<PayrollOpeningCumulativeSnapshotRow | null>
  getOrCreateOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01OpeningCumulativeInput,
  ): Promise<PayrollOpeningCumulativeSnapshotRow>
  getInputReference(
    scope: PayrollScope,
    payrollAdministrationId: string,
    calculationInputSetId: string,
  ): Promise<IndividualPayrollInputReferenceRow | null>
  insertInputReference(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01InputReferenceInput,
  ): Promise<IndividualPayrollInputReferenceRow>
  insertLifecycleEvent(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01LifecycleEventInput,
  ): Promise<IndividualPayrollLifecycleEventRow>
  listLifecycleEvents(
    scope: PayrollScope,
    payrollAdministrationId: string,
    payrollPeriodId: string,
    sourceEmploymentId: string,
  ): Promise<readonly IndividualPayrollLifecycleEventRow[]>
  insertArtifact(
    scope: PayrollScope,
    payrollAdministrationId: string,
    metadata: Payrun01ArtifactMetadata,
    bytes: Uint8Array,
  ): Promise<Payrun01Artifact>
  getArtifact(
    scope: PayrollScope,
    payrollAdministrationId: string,
    calculationRunId: string,
    artifactType: PayrollIndividualArtifactRow['artifact_type'],
  ): Promise<Payrun01Artifact | null>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

class UniqueInsertConflict extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasDatabaseCode(error: unknown, expectedCode: string): boolean {
  return isRecord(error) && error.code === expectedCode
}

function safeDatabaseCode(error: unknown): string | null {
  if (!isRecord(error) || typeof error.code !== 'string' || !/^[0-9A-Z]{5}$/.test(error.code)) return null
  return error.code
}

function throwOnReadError(error: unknown): void {
  if (error) throw new PayrollCalculationRepositoryError()
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new PayrollCalculationRepositoryError('PAYRUN01_ID_INVALID')
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new PayrollCalculationRepositoryError('PAYRUN01_VERSION_INVALID')
}

function assertDate(value: string): void {
  if (!ISO_DATE_PATTERN.test(value)) throw new PayrollCalculationRepositoryError('PAYRUN01_DATE_INVALID')
  const parsedDate = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_DATE_INVALID')
  }
}

function assertHash(value: string): void {
  if (!HASH_PATTERN.test(value)) throw new PayrollCalculationRepositoryError('PAYRUN01_HASH_INVALID')
}

function assertCanonicalJsonHash(value: unknown, hash: string): void {
  assertHash(hash)
  const calculatedHash = createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
  if (calculatedHash !== hash) throw new PayrollCalculationRepositoryError('PAYRUN01_HASH_MISMATCH')
}

function assertJsonObject(value: unknown): void {
  if (!isRecord(value)) throw new PayrollCalculationRepositoryError('PAYRUN01_PAYLOAD_INVALID')
}

function encodeJsonPrimitive(value: string | number | boolean | null): string {
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new PayrollCalculationRepositoryError('PAYRUN01_PAYLOAD_INVALID')
  return encoded
}

function assertScopedRow(scope: PayrollScope, payrollAdministrationId: string, row: ScopeColumns): void {
  const checkedScope = assertPayrollScope(scope)
  assertUuid(payrollAdministrationId)
  if (row.created_by_user_id === null) throw new PayrollCalculationRepositoryError('PAYRUN01_ACTOR_INVALID')
  assertUuid(row.created_by_user_id)
  if (row.payroll_administration_id !== payrollAdministrationId
    || row.source_tenant_id !== checkedScope.tenantId
    || row.source_hr_group_id !== checkedScope.hrGroupId
    || row.source_administration_id !== checkedScope.administrationId) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_SCOPE_MISMATCH')
  }
}

function assertStoredScope(scope: PayrollScope, payrollAdministrationId: string, row: ScopeColumns): void {
  try {
    assertScopedRow(scope, payrollAdministrationId, row)
  } catch {
    throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_SCOPE_INVALID')
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return encodeJsonPrimitive(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PayrollCalculationRepositoryError('PAYRUN01_PAYLOAD_INVALID')
    return encodeJsonPrimitive(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  if (isRecord(value)) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_PAYLOAD_INVALID')
    }
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return `{${entries.map(([key, item]) => `${encodeJsonPrimitive(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  throw new PayrollCalculationRepositoryError('PAYRUN01_PAYLOAD_INVALID')
}

function hasSameContent<Row extends Record<string, unknown>>(
  stored: Row,
  requested: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => canonicalJson(stored[field]) === canonicalJson(requested[field]))
}

function isUniqueInsertConflict(error: unknown): boolean {
  return hasDatabaseCode(error, '23505')
}

async function selectOne<Row>(query: PromiseLike<{ data: Row | null; error: unknown }>): Promise<Row | null> {
  const { data, error } = await query
  throwOnReadError(error)
  return data
}

async function selectRows<Row>(query: PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<readonly Row[]> {
  const { data, error } = await query
  throwOnReadError(error)
  return data ?? []
}

async function insertOne<Row>(query: PromiseLike<{ data: Row | null; error: unknown }>): Promise<Row> {
  const { data, error } = await query
  if (isUniqueInsertConflict(error)) throw new UniqueInsertConflict()
  if (error) throw new PayrollCalculationRepositoryError()
  if (!data) throw new PayrollCalculationRepositoryError()
  return data
}

async function getOrCreateImmutable<Row>(
  read: () => Promise<Row | null>,
  write: () => Promise<Row>,
  matches: (stored: Row) => boolean,
  conflictCode = 'PAYRUN01_VERSION_CONFLICT',
): Promise<Row> {
  const existing = await read()
  if (existing) {
    if (!matches(existing)) throw new PayrollCalculationRepositoryError(conflictCode)
    return existing
  }

  try {
    const inserted = await write()
    if (!matches(inserted)) throw new PayrollCalculationRepositoryError('PAYRUN01_INSERT_READBACK_MISMATCH')
    return inserted
  } catch (error) {
    if (!(error instanceof UniqueInsertConflict)) throw error
    const raced = await read()
    if (raced && matches(raced)) return raced
    throw new PayrollCalculationRepositoryError(conflictCode)
  }
}

function assertAssignmentVersionInput(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01AssignmentVersionInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.assignment_id)
  assertUuid(row.source_employment_id)
  assertVersion(row.assignment_version)
  assertDate(row.effective_from)
  if (row.effective_to !== null) assertDate(row.effective_to)
  if (row.effective_to !== null && row.effective_to < row.effective_from) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_DATE_RANGE_INVALID')
  }
  assertJsonObject(row.assignment_json)
  assertCanonicalJsonHash(row.assignment_json, row.assignment_hash)
  if (!row.provenance_source.trim()) throw new PayrollCalculationRepositoryError('PAYRUN01_PROVENANCE_INVALID')
}

function assertConfigVersionInput(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01CalculationConfigVersionInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.source_employment_id)
  assertVersion(row.config_version)
  assertDate(row.effective_from)
  if (row.effective_to !== null) assertDate(row.effective_to)
  if (row.effective_to !== null && row.effective_to < row.effective_from) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_DATE_RANGE_INVALID')
  }
  assertJsonObject(row.config_json)
  assertCanonicalJsonHash(row.config_json, row.config_hash)
  if (!row.provenance_source.trim()) throw new PayrollCalculationRepositoryError('PAYRUN01_PROVENANCE_INVALID')
}

function assertCompositionInput(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01ArrangementCompositionInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.assignment_version_id)
  assertUuid(row.source_employment_id)
  assertDate(row.as_of_date)
  assertJsonObject(row.snapshot_json)
  assertCanonicalJsonHash(row.snapshot_json, row.snapshot_hash)
}

function assertOpeningCumulativeInput(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01OpeningCumulativeInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.source_employment_id)
  assertVersion(row.snapshot_version)
  assertDate(row.as_of_date)
  assertJsonObject(row.opening_balance_json)
  assertCanonicalJsonHash(row.opening_balance_json, row.snapshot_hash)
  if (!row.provenance_source.trim()) throw new PayrollCalculationRepositoryError('PAYRUN01_PROVENANCE_INVALID')
}

function assertInputReference(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01InputReferenceInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.calculation_input_set_id)
  assertUuid(row.source_employment_id)
  assertUuid(row.assignment_version_id)
  assertUuid(row.arrangement_snapshot_id)
  assertUuid(row.config_version_id)
  assertUuid(row.opening_cumulative_snapshot_id)
  assertJsonObject(row.input_provenance_json)
}

function assertLifecycleEvent(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: Payrun01LifecycleEventInput,
): void {
  assertScopedRow(scope, payrollAdministrationId, row)
  assertUuid(row.payroll_period_id)
  assertUuid(row.source_employment_id)
  assertUuid(row.calculation_run_id)
  assertVersion(row.revision)
  if (!Number.isInteger(row.event_sequence) || row.event_sequence < 1 || row.event_sequence > 3) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_LIFECYCLE_SEQUENCE_INVALID')
  }
  const expectedSequence: Record<IndividualPayrollLifecycleEventRow['event_type'], number> = {
    BLOCKED: 1,
    CONCEPT: 1,
    REVIEWED: 2,
    FINALIZED: 3,
  }
  if (row.event_sequence !== expectedSequence[row.event_type]) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_LIFECYCLE_SEQUENCE_INVALID')
  }
  assertJsonObject(row.event_payload)
}

function encodeBytea(bytes: Uint8Array): string {
  return `\\x${Buffer.from(bytes).toString('hex')}`
}

function decodeBytea(value: string): Uint8Array {
  if (!value.startsWith('\\x')) throw new PayrollCalculationRepositoryError('PAYRUN01_ARTIFACT_ENCODING_INVALID')
  const hexadecimal = value.slice(2)
  if (hexadecimal.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hexadecimal)) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_ARTIFACT_ENCODING_INVALID')
  }
  return Uint8Array.from(Buffer.from(hexadecimal, 'hex'))
}

function verifyArtifact(row: PayrollIndividualArtifactRow): Payrun01Artifact {
  const bytes = decodeBytea(row.artifact_bytes)
  const actualHash = createHash('sha256').update(bytes).digest('hex')
  if (!HASH_PATTERN.test(row.artifact_hash) || actualHash !== row.artifact_hash) {
    throw new PayrollCalculationRepositoryError('PAYRUN01_ARTIFACT_HASH_MISMATCH')
  }
  return { ...row, artifact_bytes: bytes }
}

class SupabasePayrun01Repository implements Payrun01Repository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async getAssignmentVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentId: string,
    assignmentVersion: number,
  ): Promise<PayrollIndividualArrangementAssignmentVersionRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(assignmentId)
    assertVersion(assignmentVersion)
    const row = await selectOne<PayrollIndividualArrangementAssignmentVersionRow>(applyPayrollScopeFilter(
      this.client.from('payroll_individual_arrangement_assignment_versions').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('assignment_id', assignmentId)
        .eq('assignment_version', assignmentVersion),
      checkedScope,
    ).maybeSingle())
    if (row) {
      assertStoredScope(checkedScope, payrollAdministrationId, row)
      if (row.assignment_id !== assignmentId || row.assignment_version !== assignmentVersion) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_VERSION_INVALID')
      }
      assertJsonObject(row.assignment_json)
      assertCanonicalJsonHash(row.assignment_json, row.assignment_hash)
    }
    return row
  }

  async getOrCreateAssignmentVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01AssignmentVersionInput,
  ): Promise<PayrollIndividualArrangementAssignmentVersionRow> {
    assertAssignmentVersionInput(scope, payrollAdministrationId, row)
    const read = () => this.getAssignmentVersion(scope, payrollAdministrationId, row.assignment_id, row.assignment_version)
    const fields = [
      'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'assignment_id', 'assignment_version', 'source_employment_id', 'effective_from', 'effective_to',
      'assignment_json', 'assignment_hash', 'provenance_status', 'provenance_source',
    ] as const
    return await getOrCreateImmutable(
      read,
      async () => await insertOne(this.client.from('payroll_individual_arrangement_assignment_versions').insert(row).select('*').single()),
      (stored) => hasSameContent(stored, row, fields),
    )
  }

  async getCalculationConfigVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId: string,
    configVersion: number,
  ): Promise<PayrollIndividualCalculationConfigVersionRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(sourceEmploymentId)
    assertVersion(configVersion)
    const row = await selectOne<PayrollIndividualCalculationConfigVersionRow>(applyPayrollScopeFilter(
      this.client.from('payroll_individual_calculation_config_versions').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('source_employment_id', sourceEmploymentId)
        .eq('config_version', configVersion),
      checkedScope,
    ).maybeSingle())
    if (row) {
      assertStoredScope(checkedScope, payrollAdministrationId, row)
      if (row.source_employment_id !== sourceEmploymentId || row.config_version !== configVersion) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_VERSION_INVALID')
      }
      assertJsonObject(row.config_json)
      assertCanonicalJsonHash(row.config_json, row.config_hash)
    }
    return row
  }

  async getOrCreateCalculationConfigVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01CalculationConfigVersionInput,
  ): Promise<PayrollIndividualCalculationConfigVersionRow> {
    assertConfigVersionInput(scope, payrollAdministrationId, row)
    const read = () => this.getCalculationConfigVersion(scope, payrollAdministrationId, row.source_employment_id, row.config_version)
    const fields = [
      'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'source_employment_id', 'config_version', 'effective_from', 'effective_to', 'config_json', 'config_hash',
      'provenance_status', 'provenance_source',
    ] as const
    return await getOrCreateImmutable(
      read,
      async () => await insertOne(this.client.from('payroll_individual_calculation_config_versions').insert(row).select('*').single()),
      (stored) => hasSameContent(stored, row, fields),
    )
  }

  async getArrangementCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    assignmentVersionId: string,
    asOfDate: string,
  ): Promise<PayrollIndividualArrangementCompositionSnapshotRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(assignmentVersionId)
    assertDate(asOfDate)
    const row = await selectOne<PayrollIndividualArrangementCompositionSnapshotRow>(applyPayrollScopeFilter(
      this.client.from('payroll_individual_arrangement_composition_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('assignment_version_id', assignmentVersionId)
        .eq('as_of_date', asOfDate),
      checkedScope,
    ).maybeSingle())
    if (row) {
      assertStoredScope(checkedScope, payrollAdministrationId, row)
      if (row.assignment_version_id !== assignmentVersionId || row.as_of_date !== asOfDate) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_VERSION_INVALID')
      }
      assertJsonObject(row.snapshot_json)
      assertCanonicalJsonHash(row.snapshot_json, row.snapshot_hash)
    }
    return row
  }

  async getOrCreateArrangementCompositionSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01ArrangementCompositionInput,
  ): Promise<PayrollIndividualArrangementCompositionSnapshotRow> {
    assertCompositionInput(scope, payrollAdministrationId, row)
    const read = () => this.getArrangementCompositionSnapshot(
      scope,
      payrollAdministrationId,
      row.assignment_version_id,
      row.as_of_date,
    )
    const fields = [
      'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'assignment_version_id', 'source_employment_id', 'as_of_date', 'snapshot_json', 'snapshot_hash',
    ] as const
    return await getOrCreateImmutable(
      read,
      async () => await insertOne(this.client.from('payroll_individual_arrangement_composition_snapshots').insert(row).select('*').single()),
      (stored) => hasSameContent(stored, row, fields),
    )
  }

  async getOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId: string,
    snapshotVersion: number,
  ): Promise<PayrollOpeningCumulativeSnapshotRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(sourceEmploymentId)
    assertVersion(snapshotVersion)
    const row = await selectOne<PayrollOpeningCumulativeSnapshotRow>(applyPayrollScopeFilter(
      this.client.from('payroll_opening_cumulative_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('source_employment_id', sourceEmploymentId)
        .eq('snapshot_version', snapshotVersion),
      checkedScope,
    ).maybeSingle())
    if (row) {
      assertStoredScope(checkedScope, payrollAdministrationId, row)
      if (row.source_employment_id !== sourceEmploymentId || row.snapshot_version !== snapshotVersion) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_VERSION_INVALID')
      }
      assertJsonObject(row.opening_balance_json)
      assertCanonicalJsonHash(row.opening_balance_json, row.snapshot_hash)
    }
    return row
  }

  async getOrCreateOpeningCumulativeSnapshot(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01OpeningCumulativeInput,
  ): Promise<PayrollOpeningCumulativeSnapshotRow> {
    assertOpeningCumulativeInput(scope, payrollAdministrationId, row)
    const read = () => this.getOpeningCumulativeSnapshot(
      scope,
      payrollAdministrationId,
      row.source_employment_id,
      row.snapshot_version,
    )
    const fields = [
      'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'source_employment_id', 'snapshot_version', 'as_of_date', 'opening_balance_json', 'snapshot_hash',
      'provenance_status', 'provenance_source',
    ] as const
    return await getOrCreateImmutable(
      read,
      async () => await insertOne(this.client.from('payroll_opening_cumulative_snapshots').insert(row).select('*').single()),
      (stored) => hasSameContent(stored, row, fields),
    )
  }

  async insertInputReference(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01InputReferenceInput,
  ): Promise<IndividualPayrollInputReferenceRow> {
    assertInputReference(scope, payrollAdministrationId, row)
    const fields = [
      'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'calculation_input_set_id', 'source_employment_id', 'assignment_version_id', 'arrangement_snapshot_id',
      'config_version_id', 'opening_cumulative_snapshot_id', 'input_provenance_json',
    ] as const
    const read = () => this.getInputReference(scope, payrollAdministrationId, row.calculation_input_set_id)
    return await getOrCreateImmutable(
      read,
      async () => {
        const { data, error } = await this.client.from('individual_payroll_input_references').insert(row).select('*').single()
        if (isUniqueInsertConflict(error)) throw new UniqueInsertConflict()
        if (error) {
          console.error('PAYRUN01_INPUT_REFERENCE_PERSISTENCE_FAILED', { sqlstate: safeDatabaseCode(error) })
          throw new PayrollCalculationRepositoryError()
        }
        if (!data) throw new PayrollCalculationRepositoryError()
        return data
      },
      (stored) => hasSameContent(stored, row, fields),
      'PAYRUN01_INPUT_REFERENCE_CONFLICT',
    )
  }

  async getInputReference(
    scope: PayrollScope,
    payrollAdministrationId: string,
    calculationInputSetId: string,
  ): Promise<IndividualPayrollInputReferenceRow | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(calculationInputSetId)
    const row = await selectOne<IndividualPayrollInputReferenceRow>(applyPayrollScopeFilter(
      this.client.from('individual_payroll_input_references').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_input_set_id', calculationInputSetId),
      checkedScope,
    ).maybeSingle())
    if (!row) return null
    assertStoredScope(checkedScope, payrollAdministrationId, row)
    if (row.calculation_input_set_id !== calculationInputSetId) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_VERSION_INVALID')
    }
    assertJsonObject(row.input_provenance_json)
    return row
  }

  async insertLifecycleEvent(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: Payrun01LifecycleEventInput,
  ): Promise<IndividualPayrollLifecycleEventRow> {
    assertLifecycleEvent(scope, payrollAdministrationId, row)
    try {
      return await insertOne(this.client.from('individual_payroll_lifecycle_events').insert(row).select('*').single())
    } catch (error) {
      if (error instanceof UniqueInsertConflict) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_LIFECYCLE_CONFLICT')
      }
      throw error
    }
  }

  async listLifecycleEvents(
    scope: PayrollScope,
    payrollAdministrationId: string,
    payrollPeriodId: string,
    sourceEmploymentId: string,
  ): Promise<readonly IndividualPayrollLifecycleEventRow[]> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(payrollPeriodId)
    assertUuid(sourceEmploymentId)
    const query = applyPayrollScopeFilter(
      this.client.from('individual_payroll_lifecycle_events').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('payroll_period_id', payrollPeriodId)
        .eq('source_employment_id', sourceEmploymentId)
        .order('revision', { ascending: true })
        .order('event_sequence', { ascending: true })
        .order('created_at', { ascending: true }),
      checkedScope,
    )
    return await selectRows<IndividualPayrollLifecycleEventRow>(query)
  }

  async insertArtifact(
    scope: PayrollScope,
    payrollAdministrationId: string,
    metadata: Payrun01ArtifactMetadata,
    bytes: Uint8Array,
  ): Promise<Payrun01Artifact> {
    assertScopedRow(scope, payrollAdministrationId, metadata)
    assertUuid(metadata.calculation_run_id)
    if (!metadata.file_name.trim() || !metadata.content_type.trim()) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_ARTIFACT_METADATA_INVALID')
    }
    assertJsonObject(metadata.provenance_json)
    const copiedBytes = Uint8Array.from(bytes)
    const artifactHash = createHash('sha256').update(copiedBytes).digest('hex')
    const row = {
      ...metadata,
      artifact_bytes: encodeBytea(copiedBytes),
      artifact_hash: artifactHash,
    }
    try {
      const inserted = await insertOne<PayrollIndividualArtifactRow>(
        this.client.from('payroll_individual_artifacts').insert(row).select('*').single(),
      )
      const verified = verifyArtifact(inserted)
      assertStoredScope(scope, payrollAdministrationId, verified)
      if (verified.calculation_run_id !== metadata.calculation_run_id
        || verified.artifact_type !== metadata.artifact_type
        || verified.file_name !== metadata.file_name
        || verified.content_type !== metadata.content_type
        || verified.artifact_hash !== artifactHash) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_INSERT_READBACK_MISMATCH')
      }
      return verified
    } catch (error) {
      if (error instanceof UniqueInsertConflict) {
        throw new PayrollCalculationRepositoryError('PAYRUN01_ARTIFACT_ALREADY_EXISTS')
      }
      throw error
    }
  }

  async getArtifact(
    scope: PayrollScope,
    payrollAdministrationId: string,
    calculationRunId: string,
    artifactType: PayrollIndividualArtifactRow['artifact_type'],
  ): Promise<Payrun01Artifact | null> {
    const checkedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(calculationRunId)
    const row = await selectOne<PayrollIndividualArtifactRow>(applyPayrollScopeFilter(
      this.client.from('payroll_individual_artifacts').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_run_id', calculationRunId)
        .eq('artifact_type', artifactType),
      checkedScope,
    ).maybeSingle())
    if (!row) return null
    const verified = verifyArtifact(row)
    assertStoredScope(checkedScope, payrollAdministrationId, verified)
    if (verified.calculation_run_id !== calculationRunId || verified.artifact_type !== artifactType) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_PERSISTED_ARTIFACT_INVALID')
    }
    return verified
  }
}

export function createPayrun01Repository(
  client: PayrollSupabaseClient = createPayrollSupabaseClient(),
): Payrun01Repository {
  return new SupabasePayrun01Repository(client)
}
