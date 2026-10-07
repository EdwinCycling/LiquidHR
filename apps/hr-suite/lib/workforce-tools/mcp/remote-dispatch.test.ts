import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DelegatedWorkforceToolExecutionContext } from '@/lib/workforce-tools/contracts'

const dispatchMocks = vi.hoisted(() => ({
  consume: vi.fn(),
  dispatch: vi.fn(),
  record: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requireHrGroupId: (context: { readonly hrGroupId?: string }) => {
    if (!context.hrGroupId) throw new Error('HR_GROUP_CONTEXT_REQUIRED')
    return context.hrGroupId
  },
}))
vi.mock('@/lib/workforce-tools/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workforce-tools/registry')>()
  return { ...actual, dispatchWorkforceTool: dispatchMocks.dispatch }
})
vi.mock('@/lib/api-v1/security/audit', () => ({
  createPostgresApiReadAuditWriter: () => ({ record: dispatchMocks.record }),
}))
vi.mock('@/lib/api-v1/security/rate-limit', () => ({
  PostgresApiRateLimiter: class {
    consume = dispatchMocks.consume
  },
}))

import { WorkforceToolDispatchError } from '@/lib/workforce-tools/registry'
import { RemoteMcpToolError } from './remote-errors'
import { dispatchRemoteMcpWorkforceTool } from './remote-dispatch'

const actorId = '00000000-0000-4000-8000-000000000001'
const context = {
  authContext: {
    tenantId: '00000000-0000-4000-8000-000000000010',
    hrGroupId: '00000000-0000-4000-8000-000000000011',
    administrationId: null,
    userId: actorId,
    employeeId: '00000000-0000-4000-8000-000000000012',
    activeRoles: ['EMPLOYEE'],
    permissions: ['self:talent-goal:read'],
  },
  rls: {},
} as unknown as DelegatedWorkforceToolExecutionContext

const input = {
  toolId: 'employee.talent.development-plans.read',
  toolInput: {},
  oauthClientId: 'synthetic-chatgpt-client',
  execution: context,
}

describe('remote MCP workforce dispatch controls', () => {
  beforeEach(() => {
    dispatchMocks.consume.mockReset().mockResolvedValue({ allowed: true, remaining: 4 })
    dispatchMocks.dispatch.mockReset().mockResolvedValue({ developmentPlans: [] })
    dispatchMocks.record.mockReset().mockResolvedValue(undefined)
  })

  it('limits before dispatch and durably records an allowed read', async () => {
    await expect(dispatchRemoteMcpWorkforceTool(input)).resolves.toEqual({ developmentPlans: [] })
    expect(dispatchMocks.consume).toHaveBeenCalledWith({
      tenantId: context.authContext.tenantId,
      hrGroupId: context.authContext.hrGroupId,
      resource: 'employee-self-service',
      oauthClientId: input.oauthClientId,
    })
    expect(dispatchMocks.dispatch).toHaveBeenCalledWith(input.toolId, input.toolInput, context)
    expect(dispatchMocks.record).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: actorId,
      resource: 'employee-self-service',
      oauthClientId: input.oauthClientId,
      outcome: 'ALLOWED',
      statusCode: 200,
    }))
  })

  it('does not dispatch a rate-limited read and records HTTP 429', async () => {
    dispatchMocks.consume.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 6 })
    await expect(dispatchRemoteMcpWorkforceTool(input)).rejects.toMatchObject({ code: 'MCP_RATE_LIMITED' })
    expect(dispatchMocks.dispatch).not.toHaveBeenCalled()
    expect(dispatchMocks.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'RATE_LIMITED', statusCode: 429 }))
  })

  it('records permission denials and fails closed on limiter or audit outages', async () => {
    dispatchMocks.dispatch.mockRejectedValueOnce(new WorkforceToolDispatchError('ACCESS_DENIED'))
    await expect(dispatchRemoteMcpWorkforceTool(input)).rejects.toMatchObject({ code: 'MCP_AUTHORIZATION_DENIED' })
    expect(dispatchMocks.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'DENIED', statusCode: 403 }))

    dispatchMocks.consume.mockRejectedValueOnce(new Error('private database detail'))
    await expect(dispatchRemoteMcpWorkforceTool(input)).rejects.toBeInstanceOf(RemoteMcpToolError)
    expect(dispatchMocks.dispatch).toHaveBeenCalledOnce()
    expect(dispatchMocks.record).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'FAILED', statusCode: 503 }))

    dispatchMocks.record.mockRejectedValueOnce(new Error('private audit detail'))
    await expect(dispatchRemoteMcpWorkforceTool(input)).rejects.toMatchObject({ code: 'MCP_SERVICE_UNAVAILABLE' })
  })
})
