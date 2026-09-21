import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthorizationContext, setFocusPreviewCookie } = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
  setFocusPreviewCookie: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, getRequestAuthorizationContext }
})
vi.mock('@/lib/focus/preview-token', () => ({ setFocusPreviewCookie }))

import { POST } from './route'

const fixtureEmployeeId = '9569dc52-1af6-3bc8-3f00-133533d392f2'

function employeeQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: fixtureEmployeeId }, error: null })
  return query
}

describe('POST /api/focus/preview', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const query = employeeQuery()
    getRequestAuthorizationContext.mockResolvedValue({
      context: { userId: 'user-1', tenantId: 'tenant-1', hrGroupId: 'group-1', permissions: ['user:invite'] },
      supabase: { from: vi.fn(() => query) },
    })
    setFocusPreviewCookie.mockResolvedValue(undefined)
  })

  it('accepts deterministic database UUIDs used by DEV fixtures', async () => {
    const response = await POST(new Request('http://localhost/api/focus/preview', {
      method: 'POST',
      body: JSON.stringify({ employeeId: fixtureEmployeeId }),
    }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { employeeId: fixtureEmployeeId } })
    expect(setFocusPreviewCookie).toHaveBeenCalledWith({ actorUserId: 'user-1', tenantId: 'tenant-1', hrGroupId: 'group-1', employeeId: fixtureEmployeeId })
  })
})
