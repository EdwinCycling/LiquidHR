import { describe, expect, it, vi } from 'vitest'

const { requirePermission, MockAuthenticationError, MockAuthorizationError } = vi.hoisted(() => {
  class TestAuthenticationError extends Error {}
  class TestAuthorizationError extends Error {}
  return {
    requirePermission: vi.fn(),
    MockAuthenticationError: TestAuthenticationError,
    MockAuthorizationError: TestAuthorizationError,
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  requirePermission,
  AuthenticationError: MockAuthenticationError,
  AuthorizationError: MockAuthorizationError,
}))

import type { AiInvocationInput, AiRuntimeDependencies } from './contracts'
import { runAuthorizedAiInvocation } from './runtime'

const input: Omit<AiInvocationInput, 'authContext'> = {
  featureCode: 'test-ai-runtime',
  businessObject: { type: 'employee-note', id: 'note-1' },
  idempotencyKey: 'entrypoint-test',
  businessPermissionCode: 'employee:read',
  businessPermissionTargetId: 'employee-1',
}

describe('AI server entrypoint', () => {
  it('gebruikt de bestaande permission resolver voordat runtime dependencies worden aangeraakt', async () => {
    requirePermission.mockRejectedValueOnce(new MockAuthorizationError('denied'))

    await expect(runAuthorizedAiInvocation(input, {} as AiRuntimeDependencies<unknown>))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(requirePermission).toHaveBeenCalledWith('employee:read', 'employee-1')
  })
})
