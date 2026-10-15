import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireAuthContext: vi.fn(),
  requirePermission: vi.fn(),
}))
vi.mock('@/lib/employees/employee-service', () => ({ employeeAvatarHref: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import type { createClient as createServerClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { getContinuousAppraisalAttachmentDownload, softDeleteContinuousAppraisalItem, transitionContinuousAppraisalItemStatus } from './service'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

const tenantId = '11111111-1111-4111-8111-111111111111'
const itemId = '22222222-2222-4222-8222-222222222222'
const attachmentId = '33333333-3333-4333-8333-333333333333'

class AttachmentQuery {
  selectedColumns = ''

  constructor(private readonly row: object | null) {}

  select(columns: string) { this.selectedColumns = columns; return this }
  eq() { return this }
  maybeSingle() { return Promise.resolve({ data: this.row, error: null }) }
}

const actor = {
  tenantId,
  administrationId: null,
  userId: 'user-actor',
  employeeId: 'employee-actor',
  activeRoles: [],
  permissions: ['continuous-appraisal:write'],
}

function mutationClient(item: object, rpc = vi.fn(), context = actor) {
  const query = new AttachmentQuery(item)
  createClient.mockResolvedValue({ from: vi.fn(() => query), rpc } as unknown as SupabaseServerClient)
  vi.mocked(requirePermission).mockResolvedValue(context)
  return rpc
}

describe('continuous appraisal attachment download security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not sign an object whose key belongs to another tenant, item, or attachment', async () => {
    const foreignKey = `44444444-4444-4444-8444-444444444444/${itemId}/${attachmentId}/review.pdf`
    const query = new AttachmentQuery({
      id: attachmentId,
      tenant_id: tenantId,
      item_id: itemId,
      storage_key: foreignKey,
    })
    const createSignedUrl = vi.fn()
    createClient.mockResolvedValue({ from: vi.fn(() => query) } as unknown as SupabaseServerClient)
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } })

    await expect(getContinuousAppraisalAttachmentDownload(attachmentId)).rejects.toMatchObject({
      code: 'CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND',
      status: 404,
    })
    expect(query.selectedColumns).toBe('id, tenant_id, item_id, storage_key')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('signs only the exact key bound to the visible attachment record', async () => {
    const storageKey = `${tenantId}/${itemId}/${attachmentId}/review.pdf`
    const query = new AttachmentQuery({
      id: attachmentId,
      tenant_id: tenantId,
      item_id: itemId,
      storage_key: storageKey,
    })
    const signedUrl = 'https://storage.example/signed/test-only'
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query) } as unknown as SupabaseServerClient)
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } })

    await expect(getContinuousAppraisalAttachmentDownload(attachmentId)).resolves.toBe(signedUrl)
    expect(createSignedUrl).toHaveBeenCalledWith(storageKey, 60)
  })
})

describe('continuous appraisal status and soft-delete authorization', () => {
  beforeEach(() => vi.clearAllMocks())

  const item = (overrides: Record<string, unknown> = {}) => ({
    employee_id: actor.employeeId,
    created_by_employee_id: actor.employeeId,
    item_type: 'ACTION',
    item_status: 'OPEN',
    ...overrides,
  })

  it('uses an optimistic status-transition RPC for a maker-authorized item', async () => {
    const rpc = mutationClient(item(), vi.fn().mockResolvedValue({ data: { id: itemId, version: 3 }, error: null }))

    await expect(transitionContinuousAppraisalItemStatus(itemId, { version: 2, itemStatus: 'DONE' })).resolves.toEqual({ id: itemId, version: 3 })
    expect(rpc).toHaveBeenCalledWith('transition_continuous_appraisal_item_status', { p_item_id: itemId, p_expected_version: 2, p_item_status: 'DONE' })
  })

  it('allows a scoped manager to transition an open item after manager handover', async () => {
    const rpc = mutationClient(item({ employee_id: 'employee-target', created_by_employee_id: 'old-manager' }), vi.fn().mockResolvedValue({ data: { id: itemId, version: 3 }, error: null }), { ...actor, employeeId: 'new-manager', permissions: ['continuous-appraisal:manage'] })

    await expect(transitionContinuousAppraisalItemStatus(itemId, { version: 1, itemStatus: 'NOT_RELEVANT' })).resolves.toEqual({ id: itemId, version: 3 })
    expect(rpc).toHaveBeenCalledWith('transition_continuous_appraisal_item_status', { p_item_id: itemId, p_expected_version: 1, p_item_status: 'NOT_RELEVANT' })
  })

  it('surfaces an optimistic version conflict without retrying or rewriting content', async () => {
    const rpc = mutationClient(item(), vi.fn().mockResolvedValue({ data: null, error: { message: 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT' } }))

    await expect(transitionContinuousAppraisalItemStatus(itemId, { version: 1, itemStatus: 'NOT_RELEVANT' })).rejects.toMatchObject({ code: 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT', status: 409 })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('calls the explicit soft-delete RPC with the expected version', async () => {
    const rpc = mutationClient(item(), vi.fn().mockResolvedValue({ data: { id: itemId, version: 2 }, error: null }))

    await expect(softDeleteContinuousAppraisalItem(itemId, { version: 1 })).resolves.toEqual({ id: itemId, version: 2 })
    expect(rpc).toHaveBeenCalledWith('soft_delete_continuous_appraisal_item', { p_item_id: itemId, p_expected_version: 1 })
  })

  it('allows the assigned owner to soft-delete their item through the RPC', async () => {
    const rpc = mutationClient(item({ created_by_employee_id: 'manager-creator', owner_employee_id: actor.employeeId }), vi.fn().mockResolvedValue({ data: { id: itemId, version: 2 }, error: null }))

    await expect(softDeleteContinuousAppraisalItem(itemId, { version: 1 })).resolves.toEqual({ id: itemId, version: 2 })
    expect(rpc).toHaveBeenCalledWith('soft_delete_continuous_appraisal_item', { p_item_id: itemId, p_expected_version: 1 })
  })
})
