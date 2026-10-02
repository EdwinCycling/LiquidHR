import { describe, expect, it, vi } from 'vitest'
import type { ComponentCatalogEntry } from './component-catalog'
import { SYSTEM_COMPONENT_CATALOG } from './component-catalog'
import type { PayrollCustomerComponentVersionRow, PayrollDatabase } from './database'
import { createComponentDraftService } from './component-draft-service'
import {
  ComponentDraftRepositoryError,
  createComponentDraftRepository,
} from './component-draft-repository'
import type { ComponentDraftRepository } from './component-draft-repository'
import type { PayrollScope } from './scope'
import type { PayrollSupabaseClient } from './supabase-types'

const scope: PayrollScope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const componentId = '10000000-0000-4000-8000-000000000010'
const rowId = '20000000-0000-4000-8000-000000000001'
const now = '2026-10-01T10:00:00.000Z'

function getSystemEntry(): ComponentCatalogEntry {
  const entry = SYSTEM_COMPONENT_CATALOG.find((candidate) => candidate.forkable && candidate.ownership === 'SYSTEM')
  if (!entry) throw new Error('Payroll system catalog test entry is missing.')
  return entry
}

type ComponentDraftInsert = PayrollDatabase['public']['Tables']['customer_component_versions']['Insert']
type QueryResult = { readonly data: unknown; readonly error: unknown }

class QueryBuilder {
  readonly filters: Array<[string, unknown]> = []
  readonly orders: Array<{ column: string; ascending: boolean }> = []
  selectedColumns = '*'
  private operation: 'select' | 'insert' = 'select'
  private inserted: Record<string, unknown> | null = null

  constructor(
    readonly table: string,
    private readonly rowsByTable: Record<string, Array<Record<string, unknown>>>,
    private readonly queryLog: QueryBuilder[],
  ) {
    queryLog.push(this)
  }

  select(columns: string): this {
    this.selectedColumns = columns
    return this
  }

  insert(row: Record<string, unknown>): this {
    this.operation = 'insert'
    this.inserted = row
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value])
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.orders.push({ column, ascending: options.ascending })
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    const row = this.matchingRows()[0] ?? null
    return { data: row, error: null }
  }

  async single(): Promise<QueryResult> {
    if (this.operation === 'insert' && this.inserted) {
      const saved = { ...this.inserted, id: rowId, created_at: now }
      const rows = this.rowsByTable[this.table] ?? []
      rows.push(saved)
      this.rowsByTable[this.table] = rows
      return { data: saved, error: null }
    }
    return { data: this.matchingRows()[0] ?? null, error: null }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matchingRows(), error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  private matchingRows(): Array<Record<string, unknown>> {
    return (this.rowsByTable[this.table] ?? []).filter((row) => this.filters.every(([key, value]) => row[key] === value))
  }
}

function createClient(seed: Record<string, Array<Record<string, unknown>>> = {}) {
  const rowsByTable = Object.fromEntries(Object.entries(seed).map(([table, rows]) => [table, [...rows]]))
  const queryLog: QueryBuilder[] = []
  const from = vi.fn((table: string) => new QueryBuilder(table, rowsByTable, queryLog))
  return {
    client: { from } as unknown as PayrollSupabaseClient,
    from,
    queryLog,
    rowsByTable,
  }
}

async function makeDraftRow(): Promise<PayrollCustomerComponentVersionRow> {
  let stored: PayrollCustomerComponentVersionRow | null = null
  const repository: ComponentDraftRepository = {
    list: async () => stored ? [stored] : [],
    get: async () => stored,
    insert: async (_scope: PayrollScope, _adminId: string, row: ComponentDraftInsert) => {
      stored = { ...row, id: row.id ?? rowId, created_at: row.created_at ?? now }
      return stored
    },
  }
  const entry = getSystemEntry()
  const service = createComponentDraftService({
    repository,
    catalog: { getSystemComponentByKey: (key) => entry.key === key ? entry : null },
    now: () => now,
    createId: () => componentId,
  })
  return service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, entry.key)
}

describe('Payroll component draft repository', () => {
  it('applies the full tenant, HR-group, administration, and Payroll Lab administration filters on reads', async () => {
    const row = await makeDraftRow()
    const { client, queryLog } = createClient({ customer_component_versions: [row as unknown as Record<string, unknown>] })
    const repository = createComponentDraftRepository(client)

    await expect(repository.list(scope, payrollAdministrationId)).resolves.toEqual([row])
    expect(queryLog[0]?.filters).toEqual([
      ['payroll_administration_id', payrollAdministrationId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ])
    expect(queryLog[0]?.orders).toEqual([{ column: 'created_at', ascending: false }])

    await expect(repository.get(scope, payrollAdministrationId, row.id)).resolves.toEqual(row)
    expect(queryLog[1]?.filters).toEqual([
      ['id', row.id],
      ['payroll_administration_id', payrollAdministrationId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ])
  })

  it('refuses scope-forged rows, SYSTEM ownership, non-CUSTOM identity, and RegisteredRule injection before database access', async () => {
    const validDraft = await makeDraftRow()
    const { client, from } = createClient()
    const repository = createComponentDraftRepository(client)
    const validInsert: ComponentDraftInsert = { ...validDraft }
    delete validInsert.id
    delete validInsert.created_at

    await expect(repository.insert(scope, payrollAdministrationId, {
      ...validInsert,
      source_hr_group_id: '20000000-0000-4000-8000-000000000002',
    })).rejects.toBeInstanceOf(ComponentDraftRepositoryError)
    await expect(repository.insert(scope, payrollAdministrationId, {
      ...validInsert,
      ownership: 'SYSTEM' as ComponentDraftInsert['ownership'],
    })).rejects.toBeInstanceOf(ComponentDraftRepositoryError)
    await expect(repository.insert(scope, payrollAdministrationId, {
      ...validInsert,
      component_id: 'system:nl-2026:nl-tax',
      component_code: 'NL_TAX',
      definition_json: { ...validDraft.definition_json as Record<string, unknown>, method: { kind: 'registeredRule', ruleKey: 'trusted' } },
    })).rejects.toBeInstanceOf(ComponentDraftRepositoryError)
    expect(from).not.toHaveBeenCalled()
  })

  it('inserts a validated immutable customer snapshot and reads it back', async () => {
    const validDraft = await makeDraftRow()
    const { client, queryLog, rowsByTable } = createClient()
    const repository = createComponentDraftRepository(client)
    const insertRow: ComponentDraftInsert = { ...validDraft }
    delete insertRow.id
    delete insertRow.created_at

    const inserted = await repository.insert(scope, payrollAdministrationId, insertRow)

    expect(inserted.id).toBe(rowId)
    expect(queryLog[0]?.table).toBe('customer_component_versions')
    expect(queryLog[0]?.filters).toEqual([])
    expect(rowsByTable.customer_component_versions).toHaveLength(1)
    await expect(repository.get(scope, payrollAdministrationId, rowId)).resolves.toEqual(inserted)
  })
})
