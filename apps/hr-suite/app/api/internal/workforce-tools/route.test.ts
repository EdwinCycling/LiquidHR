import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dispatchWorkforceTool, requireAuthContext, permissionErrorResponse } = vi.hoisted(() => ({
  dispatchWorkforceTool: vi.fn(),
  requireAuthContext: vi.fn(),
  permissionErrorResponse: vi.fn(),
}))

vi.mock('@/lib/workforce-tools/registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/workforce-tools/registry')>()
  return { ...original, dispatchWorkforceTool }
})
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, permissionErrorResponse }))

import { POST } from './route'
import { WorkforceToolDispatchError } from '@/lib/workforce-tools/registry'

function post(body: unknown): Request {
  return new Request('http://localhost/api/internal/workforce-tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/internal/workforce-tools', () => {
  beforeEach(() => {
    dispatchWorkforceTool.mockReset()
    requireAuthContext.mockReset().mockResolvedValue({ userId: 'user-1' })
    permissionErrorResponse.mockReset().mockReturnValue(null)
  })

  it('rejects caller-supplied identity or tenant fields before dispatch', async () => {
    const response = await POST(post({ toolId: 'employee.talent.skills.read', input: {}, tenantId: 'tenant-2' }))
    expect(response.status).toBe(400)
    expect(requireAuthContext).not.toHaveBeenCalled()
    expect(dispatchWorkforceTool).not.toHaveBeenCalled()
  })

  it('requires a signed-in server context and dispatches the shared catalog tool', async () => {
    dispatchWorkforceTool.mockResolvedValue({ skills: [] })
    const response = await POST(post({ toolId: 'employee.talent.skills.read', input: {} }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ data: { skills: [] } })
    expect(requireAuthContext).toHaveBeenCalledOnce()
    expect(dispatchWorkforceTool).toHaveBeenCalledWith('employee.talent.skills.read', {})
  })

  it('maps an unexpected tool error to a generic server failure without returning internal details', async () => {
    dispatchWorkforceTool.mockRejectedValue(new Error('WORKFORCE_TOOL_ACCESS_DENIED'))
    const response = await POST(post({ toolId: 'employee.talent.skills.read', input: {} }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'WORKFORCE_TOOL_EXECUTION_FAILED' })
  })

  it('maps a disabled Talent module to a stable not-found response', async () => {
    dispatchWorkforceTool.mockRejectedValue(new WorkforceToolDispatchError('MODULE_INACTIVE'))

    const response = await POST(post({ toolId: 'employee.talent.skills.read', input: {} }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'MODULE_INACTIVE' })
  })

  it('maps an inaccessible self-bound resource to a generic not-found response', async () => {
    dispatchWorkforceTool.mockRejectedValue(new WorkforceToolDispatchError('RESOURCE_NOT_FOUND'))

    const response = await POST(post({ toolId: 'employee.talent.goal-check-ins.read', input: { goalId: '00000000-0000-0000-0000-000000000001' } }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'RESOURCE_NOT_FOUND' })
  })
})
