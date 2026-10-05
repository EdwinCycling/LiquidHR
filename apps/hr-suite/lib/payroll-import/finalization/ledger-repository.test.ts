import { describe, expect, it } from 'vitest'
import { confirmPayrollImportDecision } from './decision-contract'
import {
  persistConfirmedPayrollImportDecision,
  type PersistDecisionInput,
} from './ledger-repository'
import type {
  Control02FinalizationClient,
  PayrollImportDecisionRow,
} from './ledger-database'

const actorUserId = '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d'
const tenantId = '00000000-0000-4000-8000-000000000001'
const hrGroupId = '00000000-0000-4000-8000-000000000002'
const administrationId = '00000000-0000-4000-8000-000000000003'
const batchId = '00000000-0000-4000-8000-000000000004'
const importPersonId = '00000000-0000-4000-8000-000000000005'
const employeeId = '00000000-0000-4000-8000-000000000006'
const employmentId = '00000000-0000-4000-8000-000000000007'
const sourceHash = 'a'.repeat(64)
const analysisHash = 'b'.repeat(64)
const coreStateHash = 'c'.repeat(64)

type FakeError = { code?: string; message?: string }
type QueryResult<T> = { data: T | null; error: FakeError | null }
type FilterValue = string | number

type FakeSelectBuilder = {
  eq: (column: string, value: FilterValue) => FakeSelectBuilder
  maybeSingle: () => Promise<QueryResult<PayrollImportDecisionRow>>
}

type FakeInsertBuilder = {
  select: (columns: string) => {
    single: () => Promise<QueryResult<PayrollImportDecisionRow>>
  }
}

type FakeDecisionTable = {
  insert: (row: Partial<PayrollImportDecisionRow>) => FakeInsertBuilder
  select: (columns: string) => FakeSelectBuilder
}

function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) throw new Error(`missing fake row field: ${field}`)
  return value
}

class DecisionPersistenceFake {
  readonly rows: PayrollImportDecisionRow[] = []
  private nextId = 100

  client(): Control02FinalizationClient {
    return {
      from: (table: string): FakeDecisionTable => {
        if (table !== 'payroll_import_decisions') throw new Error(`unexpected table: ${table}`)
        return this.table()
      },
    } as unknown as Control02FinalizationClient
  }

  private table(): FakeDecisionTable {
    return {
      insert: (input) => ({
        select: () => ({
          single: async () => {
            const duplicate = this.rows.find((row) => row.tenant_id === input.tenant_id
              && row.hr_group_id === input.hr_group_id
              && row.batch_id === input.batch_id
              && row.import_person_id === input.import_person_id
              && row.decision_version === input.decision_version)
            if (duplicate) {
              return {
                data: null,
                error: { code: '23505', message: 'duplicate decision version' },
              }
            }
            const row: PayrollImportDecisionRow = {
              id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`,
              tenant_id: required(input.tenant_id, 'tenant_id'),
              hr_group_id: required(input.hr_group_id, 'hr_group_id'),
              administration_id: required(input.administration_id, 'administration_id'),
              batch_id: required(input.batch_id, 'batch_id'),
              import_person_id: required(input.import_person_id, 'import_person_id'),
              decision_version: required(input.decision_version, 'decision_version'),
              decision_payload: required(input.decision_payload, 'decision_payload'),
              decision_hash: required(input.decision_hash, 'decision_hash'),
              source_hash: required(input.source_hash, 'source_hash'),
              analysis_hash: required(input.analysis_hash, 'analysis_hash'),
              core_state_hash: required(input.core_state_hash, 'core_state_hash'),
              contract_version: input.contract_version ?? null,
              schema_version: input.schema_version ?? null,
              confirmer_user_id: required(input.confirmer_user_id, 'confirmer_user_id'),
              confirmed_at: required(input.confirmed_at, 'confirmed_at'),
              created_at: '2026-10-05T10:00:00.000Z',
            }
            this.rows.push(row)
            return { data: row, error: null }
          },
        }),
      }),
      select: () => this.selectBuilder([]),
    }
  }

  private selectBuilder(filters: readonly (readonly [string, FilterValue])[]): FakeSelectBuilder {
    return {
      eq: (column, value) => this.selectBuilder([...filters, [column, value]]),
      maybeSingle: async () => {
        const matches = this.rows.filter((row) => filters.every(([column, value]) => {
          const current = row[column as keyof PayrollImportDecisionRow]
          return current === value
        }))
        return { data: matches[0] ?? null, error: null }
      },
    }
  }
}

function decision(sourceFieldDecision: 'KEEP_CURRENT' | 'USE_SOURCE') {
  return confirmPayrollImportDecision({
    decision: {
      match: { action: 'REUSE_EMPLOYEE', employeeId, confirmed: true },
      incomeRelationshipBySourceRef: {
        income: { action: 'NO_CHANGE', confirmed: true },
      },
      employmentByIncomeRelationship: {
        income: { action: 'REUSE_EMPLOYMENT', employmentId, confirmed: true },
      },
      sourceFieldDecisions: { firstName: sourceFieldDecision },
    },
    decisionVersion: 1,
    confirmerUserId: actorUserId,
    confirmedAt: '2026-10-05T10:00:00.000Z',
    sourceHash,
    analysisHash,
    coreStateHash,
  })
}

function inputFor(confirmedDecision: ReturnType<typeof decision>): PersistDecisionInput {
  return {
    tenantId,
    hrGroupId,
    administrationId,
    batchId,
    importPersonId,
    decision: confirmedDecision,
    actorUserId,
    sourceHash,
    analysisHash,
    coreStateHash,
    contractVersion: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
    schemaVersion: 'Loonaangifte-2026-v2.0',
  }
}

describe('CONTROL02 finalization decision repository', () => {
  it('inserts and reads back a server-confirmed decision, then replays idempotently', async () => {
    const fake = new DecisionPersistenceFake()
    const client = fake.client()
    const input = inputFor(decision('KEEP_CURRENT'))

    const first = await persistConfirmedPayrollImportDecision(input, client)
    const replay = await persistConfirmedPayrollImportDecision(input, client)

    expect(first).toMatchObject({
      id: '00000000-0000-4000-8000-000000000100',
      scope: { tenantId, hrGroupId, administrationId, batchId, importPersonId },
      decisionVersion: 1,
      decisionHash: input.decision.decisionHash,
      sourceHash,
      analysisHash,
      coreStateHash,
      contractVersion: input.contractVersion,
      schemaVersion: input.schemaVersion,
      confirmerUserId: actorUserId,
    })
    expect(first.decision).toEqual(input.decision.decision)
    expect(replay).toEqual(first)
    expect(fake.rows).toHaveLength(1)
  })

  it('rejects a same-version retry with a different decision hash', async () => {
    const fake = new DecisionPersistenceFake()
    const client = fake.client()
    await persistConfirmedPayrollImportDecision(inputFor(decision('KEEP_CURRENT')), client)

    await expect(
      persistConfirmedPayrollImportDecision(inputFor(decision('USE_SOURCE')), client),
    ).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT',
      status: 409,
    })
    expect(fake.rows).toHaveLength(1)
  })
})
