import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiExecutionError } from '@/lib/ai/contracts'

const { finishRealtimeVoiceSession, permissionErrorResponse, requireEmployeeVoiceContext } = vi.hoisted(() => ({
  finishRealtimeVoiceSession: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  requireEmployeeVoiceContext: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))
vi.mock('@/lib/ai/realtime-voice', () => ({
  finishRealtimeVoiceSession,
  realtimeVoiceUsageRequestSchema: {
    safeParse: () => ({
      success: true as const,
      data: {
        sessionId: '1b3b9ce1-1c89-42ea-a3a4-28d4ce9d82dd',
        toolCallCount: 0,
        terminationReason: 'FAILURE' as const,
      },
    }),
  },
  requireEmployeeVoiceContext,
}))

import { POST } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-test' }) }

describe('POST /api/employees/[employeeId]/ai/voice/usage', () => {
  beforeEach(() => {
    finishRealtimeVoiceSession.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    requireEmployeeVoiceContext.mockReset()
    requireEmployeeVoiceContext.mockResolvedValue({ userId: 'actor-test' })
  })

  it('logs a safe accounting category while returning a generic failed response', async () => {
    finishRealtimeVoiceSession.mockRejectedValue(new AiExecutionError('CREDITS_UNAVAILABLE'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(new Request('http://localhost/api/employees/employee-test/ai/voice/usage', {
      method: 'POST',
      body: JSON.stringify({}),
    }), context)

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'AI_VOICE_USAGE_FAILED' })
    expect(error).toHaveBeenCalledWith('[AI_VOICE_USAGE]', {
      category: 'credits-unavailable',
      code: 'CREDITS_UNAVAILABLE',
    })
  })
})
