import { loadEnvConfig } from '@next/env'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { findSystemComponentCatalogEntryByKey, SYSTEM_COMPONENT_CATALOG } from './component-catalog'
import { createComponentDraftRepository } from './component-draft-repository'
import { createComponentDraftService } from './component-draft-service'

const runLiveLabChecks = process.env.PAYLAB_LIVE_TEST === '1'
if (runLiveLabChecks) {
  vi.stubEnv('NODE_ENV', 'development')
  loadEnvConfig(fileURLToPath(new URL('../..', import.meta.url)))
}

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const alternateId = '10000000-0000-4000-8000-000000000006'

describe.skipIf(!runLiveLabChecks)('Payroll Lab customer component draft live persistence', () => {
  beforeAll(() => {
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      throw new Error('PAYLAB_LIVE_TEST is available only in the local development runtime.')
    }
    if (process.env.PAYROLL_LAB_ENABLED !== 'true') {
      throw new Error('PAYLAB_LIVE_TEST requires PAYROLL_LAB_ENABLED=true.')
    }
  })

  afterAll(() => {
    if (runLiveLabChecks) vi.unstubAllEnvs()
  })

  it('persists an immutable SYSTEM fork, reopens its snapshot, and isolates wrong scopes', async () => {
    const sourceEntry = SYSTEM_COMPONENT_CATALOG.find(
      (entry) => entry.ownership === 'SYSTEM' && entry.forkable,
    )
    const registeredRuleEntry = SYSTEM_COMPONENT_CATALOG.find(
      (entry) => entry.definition.method.kind === 'registeredRule',
    )
    if (!sourceEntry || !registeredRuleEntry) {
      throw new Error('Payroll system catalog test entries are missing.')
    }

    const repository = createComponentDraftRepository()
    const service = createComponentDraftService({
      repository,
      catalog: { getSystemComponentByKey: findSystemComponentCatalogEntryByKey },
    })

    // This is intentionally append-only: use one fresh synthetic fork and retain it for readback.
    const created = await service.forkSystemComponent(
      scope,
      payrollAdministrationId,
      actorUserId,
      sourceEntry.key,
    )
    const reopened = await service.get(scope, payrollAdministrationId, created.id)
    const listed = await service.list(scope, payrollAdministrationId)

    expect(created.ownership).toBe('CUSTOMER_FORK')
    expect(created.status).toBe('DRAFT')
    expect(created.component_code).toMatch(/^CUSTOM_[A-F0-9]{32}$/)
    expect(created.definition_json).toEqual(reopened?.definition_json)
    expect(created.definition_hash).toBe(reopened?.definition_hash)
    expect(listed.map((row) => row.id)).toContain(created.id)
    expect(created.component_code).not.toBe(sourceEntry.definition.code)
    expect(created.origin_component_id).toBe(sourceEntry.definition.id)

    const wrongScopes = [
      { ...scope, tenantId: alternateId },
      { ...scope, hrGroupId: alternateId },
      { ...scope, administrationId: alternateId },
    ]
    for (const wrongScope of wrongScopes) {
      expect(await service.get(wrongScope, payrollAdministrationId, created.id)).toBeNull()
      expect((await service.list(wrongScope, payrollAdministrationId)).map((row) => row.id)).not.toContain(created.id)
    }
    expect(await service.get(scope, alternateId, created.id)).toBeNull()
    expect((await service.list(scope, alternateId)).map((row) => row.id)).not.toContain(created.id)

    const beforeRejectedFork = await service.list(scope, payrollAdministrationId)
    await expect(service.forkSystemComponent(
      scope,
      payrollAdministrationId,
      actorUserId,
      registeredRuleEntry.key,
    )).rejects.toMatchObject({ code: 'PAYROLL_COMPONENT_DRAFT_SOURCE_NOT_FORKABLE' })
    const afterRejectedFork = await service.list(scope, payrollAdministrationId)
    expect(afterRejectedFork.map((row) => row.id)).toEqual(beforeRejectedFork.map((row) => row.id))
  }, 60_000)
})
