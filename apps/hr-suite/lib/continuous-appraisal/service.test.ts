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
import { getContinuousAppraisalAttachmentDownload } from './service'

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
