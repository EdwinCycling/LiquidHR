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
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { addContinuousAppraisalComment, createContinuousAppraisalAttachment, getContinuousAppraisalAttachmentDownload, softDeleteContinuousAppraisalItem, transitionContinuousAppraisalItemStatus } from './service'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

const tenantId = '11111111-1111-4111-8111-111111111111'
const itemId = '22222222-2222-4222-8222-222222222222'
const attachmentId = '33333333-3333-4333-8333-333333333333'

class AttachmentQuery {
  selectedColumns = ''

  constructor(private readonly row: object | null) {}

  select(columns: string) { this.selectedColumns = columns; return this }
  eq() { return this }
  is() { return this }
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


describe('continuous appraisal authenticated comment and attachment retries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the persisted comment for a repeated request ID without a second insert', async () => {
    const commentId = '44444444-4444-4444-8444-444444444444'
    let storedComment: Record<string, unknown> | null = null
    const itemQuery = new AttachmentQuery({ tenant_id: tenantId, employee_id: actor.employeeId })
    const employeeQuery = new AttachmentQuery({ id: actor.employeeId, first_name: 'Yara', birth_name: 'Meijer', employee_number: 'E-001', avatar_url: null })
    const commentQuery = {
      select: vi.fn(() => commentQuery),
      eq: vi.fn(() => commentQuery),
      maybeSingle: vi.fn(async () => ({ data: storedComment, error: null })),
      insert: vi.fn((payload: Record<string, unknown>) => {
        storedComment = { ...payload, created_at: '2026-10-16T09:00:00.000Z' }
        const saved = { id: storedComment.id, author_employee_id: storedComment.author_employee_id, author_label: storedComment.author_label, author_avatar_url: storedComment.author_avatar_url, body: storedComment.body, created_at: storedComment.created_at }
        return { select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: saved, error: null })) })) }
      }),
    }
    createClient.mockResolvedValue({ from: vi.fn((table: string) => table === "continuous_appraisal_items" ? itemQuery : table === "employees" ? employeeQuery : commentQuery) } as unknown as SupabaseServerClient)
    vi.mocked(requirePermission).mockResolvedValue(actor)
    vi.mocked(employeeAvatarHref).mockReturnValue(null)
    const input = { id: commentId, body: 'APPRAISAL-FIX-01 retry-safe comment' }
    const first = await addContinuousAppraisalComment(itemId, input)
    const retry = await addContinuousAppraisalComment(itemId, input)
    expect(first).toEqual(retry)
    expect(first).toMatchObject({ id: commentId, author_employee_id: actor.employeeId, body: input.body })
    expect(commentQuery.insert).toHaveBeenCalledTimes(1)
    expect(commentQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ id: commentId, item_id: itemId, author_user_id: actor.userId, body: input.body }))
  })

  it('blocks a comment before insert when the authenticated actor lacks target scope', async () => {
    const itemQuery = new AttachmentQuery({ tenant_id: tenantId, employee_id: 'employee-target' })
    const commentInsert = vi.fn()
    const commentQuery = { select: vi.fn(() => commentQuery), eq: vi.fn(() => commentQuery), maybeSingle: vi.fn(async () => ({ data: null, error: null })), insert: commentInsert }
    createClient.mockResolvedValue({ from: vi.fn((table: string) => table === "continuous_appraisal_items" ? itemQuery : commentQuery) } as unknown as SupabaseServerClient)
    vi.mocked(requirePermission).mockResolvedValue({ ...actor, employeeId: 'out-of-scope-manager', permissions: [] })
    await expect(addContinuousAppraisalComment(itemId, { id: '55555555-5555-4555-8555-555555555555', body: 'Blocked comment' })).rejects.toMatchObject({ message: 'Je hebt geen toegang tot deze medewerker.' })
    expect(commentInsert).not.toHaveBeenCalled()
  })

  it('returns the same authorized attachment when the client retries its request ID', async () => {
    const requestId = '66666666-6666-4666-8666-666666666666'
    let storedAttachment: Record<string, unknown> | null = null
    const itemQuery = new AttachmentQuery({ tenant_id: tenantId, employee_id: actor.employeeId, occurred_on: new Date().toISOString().slice(0, 10), created_by_employee_id: actor.employeeId, item_type: 'NOTE', deleted_at: null })
    const attachmentQuery = {
      select: vi.fn(() => attachmentQuery),
      eq: vi.fn(() => attachmentQuery),
      maybeSingle: vi.fn(async () => ({ data: storedAttachment, error: null })),
      insert: vi.fn((payload: Record<string, unknown>) => {
        storedAttachment = { ...payload, created_at: '2026-10-16T09:00:00.000Z' }
        const saved = { id: storedAttachment.id, item_id: storedAttachment.item_id, original_filename: storedAttachment.original_filename, content_type: storedAttachment.content_type, file_size: storedAttachment.file_size, created_at: storedAttachment.created_at }
        return { select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: saved, error: null })) })) }
      }),
    }
    createClient.mockResolvedValue({ from: vi.fn((table: string) => table === "continuous_appraisal_items" ? itemQuery : attachmentQuery) } as unknown as SupabaseServerClient)
    vi.mocked(requirePermission).mockResolvedValue(actor)
    const upload = vi.fn().mockResolvedValue({ data: { path: 'unused' }, error: null })
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ upload, remove })) } })
    const file = new File(['fixture'], 'fixture.pdf', { type: 'application/pdf' })
    const first = await createContinuousAppraisalAttachment(itemId, file, requestId)
    const retry = await createContinuousAppraisalAttachment(itemId, file, requestId)
    expect(first).toEqual(retry)
    expect(first).toMatchObject({ id: requestId, item_id: itemId, original_filename: file.name })
    expect(attachmentQuery.insert).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })
})
