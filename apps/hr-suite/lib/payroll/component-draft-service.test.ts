import { describe, expect, it, vi } from 'vitest'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import type { ComponentCatalogEntry } from './component-catalog'
import { SYSTEM_COMPONENT_CATALOG } from './component-catalog'
import type { ComponentDraftEditorInput } from './component-draft-service'
import type { PayrollCustomerComponentVersionRow, PayrollDatabase } from './database'
import {
  ComponentDraftServiceError,
  createComponentDraftService,
  toDraftCatalogEntry,
  toDraftDefinition,
} from './component-draft-service'
import type { ComponentDraftRepository } from './component-draft-repository'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const componentId = '10000000-0000-4000-8000-000000000010'
const now = '2026-10-01T10:00:00.000Z'
const sourceEntry = SYSTEM_COMPONENT_CATALOG.find((entry) => entry.forkable && entry.ownership === 'SYSTEM')
const registeredRuleEntry = SYSTEM_COMPONENT_CATALOG.find((entry) => entry.definition.method.kind === 'registeredRule')

if (!sourceEntry || !registeredRuleEntry) throw new Error('Payroll system catalog test entries are missing.')

type ComponentDraftInsert = PayrollDatabase['public']['Tables']['customer_component_versions']['Insert']

class InMemoryComponentDraftRepository implements ComponentDraftRepository {
  readonly rows: PayrollCustomerComponentVersionRow[] = []
  private nextGeneratedId = 1
  readonly insert = vi.fn(async (_scope: typeof scope, _adminId: string, row: ComponentDraftInsert) => {
    const saved: PayrollCustomerComponentVersionRow = {
      ...row,
      id: row.id ?? `20000000-0000-4000-8000-${String(this.nextGeneratedId++).padStart(12, '0')}`,
      created_at: row.created_at ?? now,
    }
    this.rows.push(saved)
    return saved
  })

  readonly list = vi.fn(async (requestedScope: typeof scope, adminId: string) => this.rows.filter((row) => (
    row.payroll_administration_id === adminId
    && row.source_tenant_id === requestedScope.tenantId
    && row.source_hr_group_id === requestedScope.hrGroupId
    && row.source_administration_id === requestedScope.administrationId
  )))

  readonly get = vi.fn(async (requestedScope: typeof scope, adminId: string, requestedId: string) => this.rows.find((row) => (
    row.id === requestedId
    && row.payroll_administration_id === adminId
    && row.source_tenant_id === requestedScope.tenantId
    && row.source_hr_group_id === requestedScope.hrGroupId
    && row.source_administration_id === requestedScope.administrationId
  )) ?? null)
}

function createService(repository = new InMemoryComponentDraftRepository(), entries: readonly ComponentCatalogEntry[] = SYSTEM_COMPONENT_CATALOG) {
  return {
    repository,
    service: createComponentDraftService({
      repository,
      catalog: { getSystemComponentByKey: (key) => entries.find((entry) => entry.key === key) ?? null },
      now: () => now,
      createId: () => componentId,
    }),
  }
}

function editorInput(row: PayrollCustomerComponentVersionRow, requestId: string, displayName: string): ComponentDraftEditorInput {
  const entry = toDraftCatalogEntry(row)
  const definition = toDraftDefinition(row)
  return {
    draftId: row.id,
    requestId,
    displayName,
    displayCode: entry.displayCode ?? row.component_code,
    description: entry.description ?? '',
    category: entry.category ?? 'expression',
    effectiveFrom: definition.effectiveFrom,
    effectiveTo: definition.effectiveTo,
    processingScope: definition.processingScope,
    inputs: definition.inputs,
    outputs: definition.outputs,
    dependencies: definition.dependencies,
    parameters: definition.parameters ?? {},
    method: null,
    tracePolicy: definition.tracePolicy,
  }
}

describe('Payroll customer component draft service', () => {
  it('copies a real safe SYSTEM definition into a detached DRAFT and reads it back with frozen provenance', async () => {
    const { repository, service } = createService()
    const systemBefore = stableSerialize(sourceEntry.definition)

    const saved = await service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, sourceEntry.key)
    const definition = toDraftDefinition(saved)
    const catalogEntry = toDraftCatalogEntry(saved)

    expect(saved.status).toBe('DRAFT')
    expect(saved.ownership).toBe('CUSTOMER_FORK')
    expect(saved.component_code).toMatch(/^CUSTOM_[A-F0-9]{32}$/)
    expect(saved.component_id).toBe(saved.component_code)
    expect(saved.component_version).toBe('1')
    expect(saved.origin_component_id).toBe(sourceEntry.definition.id)
    expect(saved.origin_component_code).toBe(sourceEntry.definition.code)
    expect(saved.origin_component_version).toBe(sourceEntry.definition.version)
    expect(saved.origin_composition_id).toBe(sourceEntry.package.compositionId)
    expect(saved.forked_at).toBe(now)
    expect(saved.definition_hash).toBe(sha256(stableSerialize(saved.definition_json)))
    expect(definition.ownership.kind).toBe('CUSTOMER_FORK')
    expect(definition.method).toEqual(sourceEntry.definition.method)
    expect(definition).not.toBe(sourceEntry.definition)
    expect(definition.inputs).not.toBe(sourceEntry.definition.inputs)
    expect(stableSerialize(sourceEntry.definition)).toBe(systemBefore)
    expect(catalogEntry.key).toBe(`draft::${saved.id}`)
    expect(catalogEntry.ownership).toBe('CUSTOMER_FORK')
    expect(catalogEntry.status).toBe('DRAFT')
    expect(catalogEntry.forkable).toBe(false)
    expect(catalogEntry.upstream).toEqual(sourceEntry.upstream)
    expect(catalogEntry.downstream).toEqual([])
    expect(repository.rows).toHaveLength(1)
    await expect(service.get(scope, payrollAdministrationId, saved.id)).resolves.toEqual(saved)
    await expect(service.list(scope, payrollAdministrationId)).resolves.toEqual([saved])
  })

  it('appends a new immutable fork version and returns the same saved row for a repeated request', async () => {
    const { repository, service } = createService()
    const systemBefore = stableSerialize(sourceEntry.definition)
    const first = await service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, sourceEntry.key)
    const input = editorInput(first, '30000000-0000-4000-8000-000000000001', 'Edited fork')

    const saved = await service.saveVersion(scope, payrollAdministrationId, actorUserId, input)
    const repeated = await service.saveVersion(scope, payrollAdministrationId, actorUserId, input)

    expect(saved.id).not.toBe(first.id)
    expect(saved.component_version).toBe('2')
    expect(toDraftCatalogEntry(saved).displayName).toBe('Edited fork')
    expect(repeated).toEqual(saved)
    expect(repository.insert).toHaveBeenCalledTimes(2)
    expect(repository.rows[0]).toEqual(first)
    expect(stableSerialize(sourceEntry.definition)).toBe(systemBefore)
    await expect(service.get(scope, payrollAdministrationId, saved.id)).resolves.toEqual(saved)
  })

  it('creates CUSTOMER_CUSTOM without SYSTEM provenance and keeps repeated submissions idempotent', async () => {
    const { repository, service } = createService()
    const input: ComponentDraftEditorInput = {
      requestId: '30000000-0000-4000-8000-000000000002',
      packageCompositionId: sourceEntry.package.compositionId,
      displayName: 'Fixed allowance',
      displayCode: 'FIXED_ALLOWANCE',
      description: 'Synthetic fixed amount.',
      category: 'Allowance',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      processingScope: 'PAYROLL_RUN',
      inputs: [],
      outputs: [{ name: 'amount', valueType: 'MONEY' }],
      dependencies: [],
      parameters: {},
      method: { kind: 'expression', outputs: { amount: { kind: 'literal', valueType: 'MONEY', value: '10.00' } } },
      tracePolicy: 'FULL',
    }

    const saved = await service.createCustomerCustom(scope, payrollAdministrationId, actorUserId, input)
    const repeated = await service.createCustomerCustom(scope, payrollAdministrationId, actorUserId, {
      ...input,
      requestId: '30000000-0000-4000-8000-000000000003',
    })

    expect(saved.ownership).toBe('CUSTOMER_CUSTOM')
    expect(saved.component_code).toMatch(/^CUSTOM_[A-F0-9]{32}$/)
    expect(saved.component_id).toBe(saved.component_code)
    expect(saved.component_version).toBe('1')
    expect(saved.origin_component_id).toBeNull()
    expect(saved.origin_component_code).toBeNull()
    expect(saved.forked_at).toBeNull()
    expect(repeated).toEqual(saved)
    expect(repository.insert).toHaveBeenCalledTimes(1)
    await expect(service.get(scope, payrollAdministrationId, saved.id)).resolves.toEqual(saved)
  })

  it('rejects a RegisteredRule even when presented by the injected catalog and performs no insert', async () => {
    const repository = new InMemoryComponentDraftRepository()
    const fakeForkableRegisteredRule = { ...registeredRuleEntry, forkable: true }
    const { service } = createService(repository, [fakeForkableRegisteredRule])

    await expect(service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, fakeForkableRegisteredRule.key))
      .rejects.toMatchObject({ code: 'PAYROLL_COMPONENT_DRAFT_SOURCE_NOT_FORKABLE' })
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('rejects a catalog entry whose customer ownership attempts to claim SYSTEM identity', async () => {
    const repository = new InMemoryComponentDraftRepository()
    const forgedOwnership = { ...sourceEntry, ownership: 'CUSTOMER_FORK' as const }
    const { service } = createService(repository, [forgedOwnership])

    await expect(service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, forgedOwnership.key))
      .rejects.toBeInstanceOf(ComponentDraftServiceError)
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('does not expose stored rows outside tenant, HR group, administration, or Payroll Lab administration scope', async () => {
    const { repository, service } = createService()
    const saved = await service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, sourceEntry.key)
    const wrongTenant = { ...scope, tenantId: '20000000-0000-4000-8000-000000000001' }
    const wrongGroup = { ...scope, hrGroupId: '20000000-0000-4000-8000-000000000002' }
    const wrongAdministration = { ...scope, administrationId: '20000000-0000-4000-8000-000000000003' }

    await expect(service.list(wrongTenant, payrollAdministrationId)).resolves.toEqual([])
    await expect(service.list(wrongGroup, payrollAdministrationId)).resolves.toEqual([])
    await expect(service.list(wrongAdministration, payrollAdministrationId)).resolves.toEqual([])
    await expect(service.get(scope, '20000000-0000-4000-8000-000000000004', saved.id)).resolves.toBeNull()
    expect(repository.rows).toHaveLength(1)
  })

  it('rejects source keys and actor/scope identifiers that do not come from the trusted server boundary', async () => {
    const { repository, service } = createService()
    const wrongScope = { ...scope, administrationId: 'not-a-uuid' }

    await expect(service.forkSystemComponent(scope, payrollAdministrationId, actorUserId, 'forged-system-key'))
      .rejects.toMatchObject({ code: 'PAYROLL_COMPONENT_DRAFT_SOURCE_NOT_FORKABLE' })
    await expect(service.forkSystemComponent(scope, payrollAdministrationId, 'bad-actor', sourceEntry.key))
      .rejects.toBeInstanceOf(ComponentDraftServiceError)
    await expect(service.list(wrongScope, payrollAdministrationId)).rejects.toBeInstanceOf(Error)
    expect(repository.insert).not.toHaveBeenCalled()
  })
})
