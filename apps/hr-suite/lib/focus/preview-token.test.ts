import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))

import { clearFocusPreviewCookie, createFocusPreviewToken, readFocusPreviewToken, setFocusPreviewCookie } from './preview-token'

describe('Focus preview cookie scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_SECRET_KEY', 'focus-preview-test-secret')
  })

  it('scopes set and clear operations to the dedicated preview route', async () => {
    await setFocusPreviewCookie({
      actorUserId: 'user-a',
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      employeeId: 'employee-a',
    })
    await clearFocusPreviewCookie()

    expect(cookieStore.set).toHaveBeenNthCalledWith(1, 'liquid-hr-focus-preview', expect.any(String), expect.objectContaining({ path: '/focus/preview' }))
    expect(cookieStore.set).toHaveBeenNthCalledWith(2, 'liquid-hr-focus-preview', '', expect.objectContaining({ path: '/focus/preview', maxAge: 0 }))
  })

  it('keeps the signed token bound to the dedicated preview read path', () => {
    const token = createFocusPreviewToken({
      actorUserId: 'user-a',
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      employeeId: 'employee-a',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })

    expect(readFocusPreviewToken(token)).toMatchObject({ actorUserId: 'user-a', employeeId: 'employee-a' })
  })
})
