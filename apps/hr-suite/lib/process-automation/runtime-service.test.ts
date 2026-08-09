import { describe, expect, it } from 'vitest'
import { processRuntimeErrorCodeFromMessage } from './runtime-service'

describe('process runtime error contract', () => {
  it.each([
    ['STALE_STATE: expected version does not match', 'STALE_STATE'],
    ['FORBIDDEN_ACTION', 'FORBIDDEN_ACTION'],
    ['NO_ASSIGNEE', 'NO_ASSIGNEE'],
    ['permission denied for function', 'FORBIDDEN'],
  ] as const)('maps %s to %s', (message, expected) => {
    expect(processRuntimeErrorCodeFromMessage(message)).toBe(expected)
  })

  it('does not expose arbitrary database text as a stable client code', () => {
    expect(processRuntimeErrorCodeFromMessage('secret connection detail')).toBe('PROCESS_WORK_ITEM_OPERATION_FAILED')
  })
})
