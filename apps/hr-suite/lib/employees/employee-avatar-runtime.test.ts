import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireHrGroupId, requirePermission } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireHrGroupId: vi.fn(() => 'hr-group-1'),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ requireHrGroupId, requirePermission }))

import { employeeAvatarHref, getEmployeeAvatar } from './employee-service'

interface AvatarQuery {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

function avatarQuery(result: { data: { avatar_url: string | null } | null; error: Error | null }): AvatarQuery {
  const query = {} as AvatarQuery
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.is = vi.fn(() => query)
  query.maybeSingle = vi.fn().mockResolvedValue(result)
  return query
}

describe('employee avatar runtime', () => {
  beforeEach(() => {
    requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'hr-group-1' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normaliseert storage-, web-, null- en ongeldige avatarwaarden vóór de browsergrens', () => {
    expect(employeeAvatarHref('employee-1', ' storage://tenant-1/employee-1/avatar.jpg ')).toBe('/api/employees/employee-1/avatar')
    expect(employeeAvatarHref('employee-1', 'https://cdn.example.test/avatar.jpg')).toBe('https://cdn.example.test/avatar.jpg')
    expect(employeeAvatarHref('employee-1', null)).toBeNull()
    expect(employeeAvatarHref('employee-1', 'storage://')).toBeNull()
    expect(employeeAvatarHref('employee-1', 'javascript:alert(1)')).toBeNull()
  })

  it('tekent een private storage-object server-side en geeft alleen bytes door', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/signed' }, error: null })
    const storage = { from: vi.fn(() => ({ createSignedUrl })) }
    createClient.mockResolvedValue({
      from: vi.fn(() => avatarQuery({ data: { avatar_url: 'storage://tenant-1/employee-1/avatar.webp' }, error: null })),
      storage,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Uint8Array.from([4, 5]), { status: 200, headers: { 'content-type': 'image/webp' } })))

    const result = await getEmployeeAvatar('employee-1')

    expect(createSignedUrl).toHaveBeenCalledWith('tenant-1/employee-1/avatar.webp', 300)
    expect(result).toEqual({ body: expect.any(ArrayBuffer), contentType: 'image/webp' })
  })

  it('valt veilig terug als signing of het private object faalt', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error('not found') })
    const fetchMock = vi.fn()
    createClient.mockResolvedValue({
      from: vi.fn(() => avatarQuery({ data: { avatar_url: 'storage://tenant-1/employee-1/missing.webp' }, error: null })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getEmployeeAvatar('employee-1')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
