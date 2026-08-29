import { describe, expect, it } from 'vitest'
import { canTransition, isTerminalStatus } from './state-machine'

describe('AI invocation state machine', () => {
  it('accepteert alleen de frozen forward transitions', () => {
    expect(canTransition('RECEIVED', 'AUTHORIZED')).toBe(true)
    expect(canTransition('EXECUTING', 'RELEASING')).toBe(true)
    expect(canTransition('VALIDATING', 'SETTLING')).toBe(true)
    expect(canTransition('SUCCEEDED', 'EXECUTING')).toBe(false)
    expect(canTransition('FAILED', 'RELEASING')).toBe(false)
  })

  it('maakt alleen succeeded, failed en rejected terminal', () => {
    expect(isTerminalStatus('SUCCEEDED')).toBe(true)
    expect(isTerminalStatus('FAILED')).toBe(true)
    expect(isTerminalStatus('REJECTED')).toBe(true)
    expect(isTerminalStatus('EXECUTING')).toBe(false)
  })
})
