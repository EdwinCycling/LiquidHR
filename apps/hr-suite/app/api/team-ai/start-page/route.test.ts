import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getTeamAiStartPageData, requirePermission } = vi.hoisted(() => ({
  getTeamAiStartPageData: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...actual, requirePermission }
})
vi.mock('@/lib/ai/team-scope', () => ({ getTeamAiStartPageData }))

import { AuthorizationError } from '@/lib/auth/permissions'
import { GET } from './route'

const auth = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['start-page:read', 'ai:use'],
}

describe('GET /api/team-ai/start-page', () => {
  beforeEach(() => {
    requirePermission.mockReset().mockResolvedValue(auth)
    getTeamAiStartPageData.mockReset()
  })

  it('returns the existing scoped Team AI data without caching', async () => {
    getTeamAiStartPageData.mockResolvedValue({
      mode: 'DIRECT_TEAM',
      scopeType: 'DIRECT_TEAM',
      contextName: 'My team',
      departmentId: null,
      members: [],
      totalMemberCount: 0,
      departments: [],
      aiEnabled: true,
      voiceEnabled: true,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({ data: { mode: 'DIRECT_TEAM', totalMemberCount: 0 } })
    expect(requirePermission.mock.calls).toEqual([[ 'start-page:read' ], [ 'ai:use' ]])
    expect(getTeamAiStartPageData).toHaveBeenCalledWith(auth)
  })

  it('rejects a caller without start-page permission before reading Team AI data', async () => {
    requirePermission.mockRejectedValueOnce(new AuthorizationError('Denied'))
    const response = await GET()

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(getTeamAiStartPageData).not.toHaveBeenCalled()
  })

  it('rejects a caller without AI permission before reading Team AI data', async () => {
    requirePermission.mockResolvedValueOnce(auth).mockRejectedValueOnce(new AuthorizationError('Denied'))
    const response = await GET()

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(getTeamAiStartPageData).not.toHaveBeenCalled()
  })
})
