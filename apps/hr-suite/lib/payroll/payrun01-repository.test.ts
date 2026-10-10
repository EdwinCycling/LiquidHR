import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  createPayrun01Repository,
  type Payrun01ArrangementCompositionInput,
  type Payrun01AssignmentVersionInput,
  type Payrun01CalculationConfigVersionInput,
  type Payrun01OpeningCumulativeInput,
} from './payrun01-repository'
import { PayrollCalculationRepositoryError } from './calculation-repository'
import type { PayrollSupabaseClient } from './supabase-types'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const employmentId = '10000000-0000-4000-8000-000000000006'
const assignmentId = '10000000-0000-4000-8000-000000000007'
const assignmentVersionId = '10000000-0000-4000-8000-000000000008'
const inputSetId = '10000000-0000-4000-8000-000000000009'
const periodId = '10000000-0000-4000-8000-000000000010'
const runId = '10000000-0000-4000-8000-000000000011'
const hash = 'a'.repeat(64)

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  const encoded = JSON.stringify(value)
  return encoded === undefined ? 'null' : encoded
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

type FakeRow = Record<string, unknown>

function makeClient(seed: Record<string, FakeRow[]> = {}, options: { readonly insertError?: unknown } = {}) {
  const rows: Record<string, FakeRow[]> = Object.fromEntries(
    Object.entries(seed).map(([table, seededRows]) => [table, [...seededRows]]),
  )
  const queryLog: Array<{ table: string; filters: Array<[string, unknown]>; operation: 'select' | 'insert' }> = []
  const from = vi.fn((table: string) => {
    const filters: Array<[string, unknown]> = []
    let operation: 'select' | 'insert' = 'select'
    let insertValue: FakeRow | null = null
    const entry: { table: string; filters: Array<[string, unknown]>; operation: 'select' | 'insert' } = {
      table,
      filters,
      operation,
    }
    queryLog.push(entry)
    const matchedRows = () => (rows[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value))
    const query = {
      select: vi.fn(() => query),
      insert: vi.fn((value: FakeRow) => {
        operation = 'insert'
        entry.operation = operation
        insertValue = value
        return query
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value])
        return query
      }),
      order: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        const selected = matchedRows()
        if (selected.length > 1) return { data: null, error: { code: 'PGRST116' } }
        return { data: selected[0] ?? null, error: null }
      }),
      single: vi.fn(async () => {
        if (operation !== 'insert' || !insertValue) return { data: null, error: { code: 'FAKE_QUERY_NOT_INSERT' } }
        if (options.insertError) return { data: null, error: options.insertError }
        const inserted = {
          ...insertValue,
          id: '20000000-0000-4000-8000-000000000001',
          created_at: '2026-10-05T12:00:00.000Z',
        }
        rows[table] ??= []
        rows[table].push(inserted)
        return { data: inserted, error: null }
      }),
      then: (
        resolve: (value: { data: FakeRow[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: matchedRows(), error: null as null }).then(resolve, reject),
    }
    return query
  })
  return { client: { from } as unknown as PayrollSupabaseClient, from, rows, queryLog }
}

function commonColumns() {
  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
    created_by_user_id: actorUserId,
  }
}

function assignmentInput(overrides: Partial<Payrun01AssignmentVersionInput> = {}): Payrun01AssignmentVersionInput {
  const row = {
    ...commonColumns(),
    assignment_id: assignmentId,
    assignment_version: 1,
    source_employment_id: employmentId,
    effective_from: '2026-09-01',
    effective_to: null,
    assignment_json: { salary: { scale: '6', step: '14' }, labels: ['test', '2026'] },
    assignment_hash: '',
    provenance_status: 'TEST_ONLY' as const,
    provenance_source: 'PAYRUN01_TEST_FIXTURE',
    ...overrides,
  }
  return { ...row, assignment_hash: overrides.assignment_hash ?? hashJson(row.assignment_json) }
}

function configInput(overrides: Partial<Payrun01CalculationConfigVersionInput> = {}): Payrun01CalculationConfigVersionInput {
  const row = {
    ...commonColumns(),
    source_employment_id: employmentId,
    config_version: 1,
    effective_from: '2026-09-01',
    effective_to: null,
    config_json: { fiscalProfile: { table: 'WHITE', payrollTaxCredit: true } },
    config_hash: '',
    provenance_status: 'TEST_ONLY' as const,
    provenance_source: 'PAYRUN01_TEST_FIXTURE',
    ...overrides,
  }
  return { ...row, config_hash: overrides.config_hash ?? hashJson(row.config_json) }
}

function compositionInput(overrides: Partial<Payrun01ArrangementCompositionInput> = {}): Payrun01ArrangementCompositionInput {
  const row = {
    ...commonColumns(),
    assignment_version_id: assignmentVersionId,
    source_employment_id: employmentId,
    as_of_date: '2026-10-01',
    snapshot_json: { assignmentVersionId, composition: { pension: 'PFZW' } },
    snapshot_hash: '',
    ...overrides,
  }
  return { ...row, snapshot_hash: overrides.snapshot_hash ?? hashJson(row.snapshot_json) }
}

function openingInput(overrides: Partial<Payrun01OpeningCumulativeInput> = {}): Payrun01OpeningCumulativeInput {
  const row = {
    ...commonColumns(),
    source_employment_id: employmentId,
    snapshot_version: 1,
    as_of_date: '2026-09-30',
    opening_balance_json: { grossWage: '2630.22', holidayReserve: '210.42', yearEndReserve: '210.42' },
    snapshot_hash: '',
    provenance_status: 'TEST_OPENING_BALANCE' as const,
    provenance_source: 'PAYRUN01_TEST_FIXTURE',
    ...overrides,
  }
  return { ...row, snapshot_hash: overrides.snapshot_hash ?? hashJson(row.opening_balance_json) }
}

function stored<T extends Record<string, unknown>>(input: T, id: string): T & { id: string; created_at: string } {
  return { ...input, id, created_at: '2026-10-05T11:00:00.000Z' }
}

describe('PAYRUN01 scoped repository', () => {
  it('reuses an exact assignment version under the complete Payroll scope', async () => {
    const row = stored(assignmentInput({
      assignment_json: { labels: ['test', '2026'], salary: { step: '14', scale: '6' } },
    }), '30000000-0000-4000-8000-000000000001')
    const fake = makeClient({ payroll_individual_arrangement_assignment_versions: [row] })
    const repository = createPayrun01Repository(fake.client)

    const result = await repository.getOrCreateAssignmentVersion(scope, payrollAdministrationId, assignmentInput())

    expect(result.id).toBe(row.id)
    expect(fake.queryLog).toHaveLength(1)
    expect(fake.queryLog[0]?.filters).toEqual(expect.arrayContaining([
      ['payroll_administration_id', payrollAdministrationId],
      ['assignment_id', assignmentId],
      ['assignment_version', 1],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ]))
  })

  it('fails closed when the requested immutable assignment version has a different hash or content', async () => {
    const row = stored(assignmentInput({ assignment_json: { salary: { scale: '7', step: '14' }, labels: ['test', '2026'] } }), '30000000-0000-4000-8000-000000000002')
    const fake = makeClient({ payroll_individual_arrangement_assignment_versions: [row] })
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getOrCreateAssignmentVersion(scope, payrollAdministrationId, assignmentInput()))
      .rejects.toMatchObject({ code: 'PAYRUN01_ASSIGNMENT_VERSION_CONFLICT' })
    expect(fake.rows.payroll_individual_arrangement_assignment_versions).toHaveLength(1)
  })

  it('fails closed when the same composition snapshot key is already bound to different content', async () => {
    const row = stored(compositionInput(), '30000000-0000-4000-8000-000000000004')
    const fake = makeClient({ payroll_individual_arrangement_composition_snapshots: [row] })
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getOrCreateArrangementCompositionSnapshot(
      scope,
      payrollAdministrationId,
      compositionInput({ snapshot_json: { assignmentVersionId, composition: { pension: 'OTHER' } } }),
    )).rejects.toMatchObject({ code: 'PAYRUN01_COMPOSITION_VERSION_CONFLICT' })
    expect(fake.rows.payroll_individual_arrangement_composition_snapshots).toHaveLength(1)
  })

  it('rejects a caller supplied payload hash that does not match canonical JSON before querying', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getOrCreateAssignmentVersion(
      scope,
      payrollAdministrationId,
      assignmentInput({ assignment_hash: 'b'.repeat(64) }),
    )).rejects.toMatchObject({ code: 'PAYRUN01_HASH_MISMATCH' })
    expect(fake.from).not.toHaveBeenCalled()
  })

  it('rejects a persisted payload whose content no longer matches its stored hash', async () => {
    const row = stored(assignmentInput(), '30000000-0000-4000-8000-000000000005')
    const tampered = { ...row, assignment_json: { salary: { scale: '8', step: '14' } } }
    const fake = makeClient({ payroll_individual_arrangement_assignment_versions: [tampered] })
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getAssignmentVersion(scope, payrollAdministrationId, assignmentId, 1))
      .rejects.toMatchObject({ code: 'PAYRUN01_HASH_MISMATCH' })
  })

  it('creates and reads the remaining versioned records using scoped identity keys', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)

    const assignment = await repository.getOrCreateAssignmentVersion(scope, payrollAdministrationId, assignmentInput())
    const config = await repository.getOrCreateCalculationConfigVersion(scope, payrollAdministrationId, configInput())
    const composition = await repository.getOrCreateArrangementCompositionSnapshot(
      scope,
      payrollAdministrationId,
      compositionInput({ assignment_version_id: assignment.id }),
    )
    const opening = await repository.getOrCreateOpeningCumulativeSnapshot(scope, payrollAdministrationId, openingInput())

    await expect(repository.getAssignmentVersion(scope, payrollAdministrationId, assignmentId, 1)).resolves.toMatchObject({ id: assignment.id })
    await expect(repository.getCalculationConfigVersion(scope, payrollAdministrationId, employmentId, 1)).resolves.toMatchObject({ id: config.id })
    await expect(repository.getArrangementCompositionSnapshot(scope, payrollAdministrationId, assignment.id, '2026-10-01'))
      .resolves.toMatchObject({ id: composition.id })
    await expect(repository.getOpeningCumulativeSnapshot(scope, payrollAdministrationId, employmentId, 1)).resolves.toMatchObject({ id: opening.id })
    expect(fake.rows.payroll_individual_calculation_config_versions).toHaveLength(1)
    expect(fake.rows.payroll_individual_arrangement_composition_snapshots).toHaveLength(1)
    expect(fake.rows.payroll_opening_cumulative_snapshots).toHaveLength(1)
  })

  it('rejects a cross-scope version before issuing any Supabase query', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getOrCreateAssignmentVersion(
      scope,
      payrollAdministrationId,
      assignmentInput({ source_administration_id: '20000000-0000-4000-8000-000000000099' }),
    )).rejects.toBeInstanceOf(PayrollCalculationRepositoryError)
    expect(fake.from).not.toHaveBeenCalled()
  })

  it('inserts scoped input references and appends ordered lifecycle events', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)
    const reference = await repository.insertInputReference(scope, payrollAdministrationId, {
      ...commonColumns(),
      calculation_input_set_id: inputSetId,
      source_employment_id: employmentId,
      assignment_version_id: assignmentVersionId,
      arrangement_snapshot_id: '10000000-0000-4000-8000-000000000012',
      config_version_id: '10000000-0000-4000-8000-000000000013',
      opening_cumulative_snapshot_id: '10000000-0000-4000-8000-000000000014',
      input_provenance_json: { projected: true },
    })
    const lifecycle = await repository.insertLifecycleEvent(scope, payrollAdministrationId, {
      ...commonColumns(),
      payroll_period_id: periodId,
      source_employment_id: employmentId,
      calculation_run_id: runId,
      revision: 1,
      event_sequence: 1,
      event_type: 'CONCEPT',
      event_payload: { inputHash: hash },
    })

    await expect(repository.listLifecycleEvents(scope, payrollAdministrationId, periodId, employmentId))
      .resolves.toEqual([lifecycle])
    expect(reference.calculation_input_set_id).toBe(inputSetId)
    expect(fake.queryLog.at(-1)?.filters).toEqual(expect.arrayContaining([
      ['payroll_period_id', periodId],
      ['source_employment_id', employmentId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ]))
  })

  it('reuses an exact persisted input reference on retry', async () => {
    const row = {
      ...commonColumns(),
      calculation_input_set_id: inputSetId,
      source_employment_id: employmentId,
      assignment_version_id: assignmentVersionId,
      arrangement_snapshot_id: '10000000-0000-4000-8000-000000000012',
      config_version_id: '10000000-0000-4000-8000-000000000013',
      opening_cumulative_snapshot_id: '10000000-0000-4000-8000-000000000014',
      input_provenance_json: { projected: true },
    }
    const existing = stored(row, '30000000-0000-4000-8000-000000000020')
    const fake = makeClient({ individual_payroll_input_references: [existing] })
    const repository = createPayrun01Repository(fake.client)

    const result = await repository.insertInputReference(scope, payrollAdministrationId, row)

    expect(result.id).toBe(existing.id)
    expect(fake.rows.individual_payroll_input_references).toHaveLength(1)
    expect(fake.queryLog[0]?.filters).toEqual(expect.arrayContaining([
      ['calculation_input_set_id', inputSetId],
      ['payroll_administration_id', payrollAdministrationId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ]))
  })

  it('logs only the SQLSTATE when input-reference persistence fails', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fake = makeClient({}, { insertError: { code: '42702', message: 'Raw database message must stay private.' } })
    const repository = createPayrun01Repository(fake.client)

    try {
      await expect(repository.insertInputReference(scope, payrollAdministrationId, {
        ...commonColumns(),
        calculation_input_set_id: inputSetId,
        source_employment_id: employmentId,
        assignment_version_id: assignmentVersionId,
        arrangement_snapshot_id: '10000000-0000-4000-8000-000000000012',
        config_version_id: '10000000-0000-4000-8000-000000000013',
        opening_cumulative_snapshot_id: '10000000-0000-4000-8000-000000000014',
        input_provenance_json: { projected: true },
      })).rejects.toBeInstanceOf(PayrollCalculationRepositoryError)
      expect(logger).toHaveBeenCalledWith('PAYRUN01_INPUT_REFERENCE_PERSISTENCE_FAILED', { sqlstate: '42702' })
      expect(JSON.stringify(logger.mock.calls)).not.toContain('Raw database message must stay private.')
    } finally {
      logger.mockRestore()
    }
  })

  it('rejects lifecycle transitions with a mismatched sequence before writing', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.insertLifecycleEvent(scope, payrollAdministrationId, {
      ...commonColumns(),
      payroll_period_id: periodId,
      source_employment_id: employmentId,
      calculation_run_id: runId,
      revision: 1,
      event_sequence: 3,
      event_type: 'REVIEWED',
      event_payload: {},
    })).rejects.toMatchObject({ code: 'PAYRUN01_LIFECYCLE_SEQUENCE_INVALID' })
    expect(fake.from).not.toHaveBeenCalled()
  })

  it('stores artifact bytes with a computed SHA-256 and verifies bytes on read', async () => {
    const fake = makeClient()
    const repository = createPayrun01Repository(fake.client)
    const bytes = Uint8Array.from([0, 1, 2, 127, 255])
    const hashOfBytes = createHash('sha256').update(bytes).digest('hex')
    const metadata = {
      ...commonColumns(),
      calculation_run_id: runId,
      artifact_type: 'TECHNICAL_JSON' as const,
      file_name: 'payrun01.json',
      content_type: 'application/json',
      provenance_json: { resultHash: hash },
    }

    const inserted = await repository.insertArtifact(scope, payrollAdministrationId, metadata, bytes)
    const loaded = await repository.getArtifact(scope, payrollAdministrationId, runId, 'TECHNICAL_JSON')

    expect(inserted.artifact_hash).toBe(hashOfBytes)
    expect(inserted.artifact_bytes).toEqual(bytes)
    expect(loaded?.artifact_hash).toBe(hashOfBytes)
    expect(loaded?.artifact_bytes).toEqual(bytes)
  })

  it('rejects corrupted persisted artifact bytes using SHA-256 verification', async () => {
    const bytes = Uint8Array.from([65, 66, 67])
    const row = stored({
      ...commonColumns(),
      calculation_run_id: runId,
      artifact_type: 'PAYSLIP_PDF',
      file_name: 'payslip.pdf',
      content_type: 'application/pdf',
      artifact_bytes: `\\x${Buffer.from(bytes).toString('hex')}`,
      artifact_hash: 'f'.repeat(64),
      provenance_json: {},
    }, '30000000-0000-4000-8000-000000000003')
    const fake = makeClient({ payroll_individual_artifacts: [row] })
    const repository = createPayrun01Repository(fake.client)

    await expect(repository.getArtifact(scope, payrollAdministrationId, runId, 'PAYSLIP_PDF'))
      .rejects.toMatchObject({ code: 'PAYRUN01_ARTIFACT_HASH_MISMATCH' })
  })
})
