import { describe, expect, it } from 'vitest'
import { processRuntimeErrorCodeFromMessage, processRuntimeErrorResponse, processRuntimeFieldKeyFromRpcDetails, ProcessRuntimeError } from './runtime-service'

describe('process runtime error contract', () => {
  it.each([
    ['STALE_STATE: expected version does not match', 'STALE_STATE'],
    ['FORBIDDEN_ACTION', 'FORBIDDEN_ACTION'],
    ['NO_ASSIGNEE', 'NO_ASSIGNEE'],
    ['permission denied for function', 'FORBIDDEN'],
  ] as const)('maps %s to %s', (message, expected) => {
    expect(processRuntimeErrorCodeFromMessage(message)).toBe(expected)
  })

  it('attaches field detail only to recognized form-validation failures', () => {
    expect(processRuntimeFieldKeyFromRpcDetails('REQUIRED_FORM_FIELD', ' high_cost_reason ')).toBe('high_cost_reason')
    expect(processRuntimeFieldKeyFromRpcDetails('INVALID_FORM_VALUE', 'expected_cost')).toBe('expected_cost')
    expect(processRuntimeFieldKeyFromRpcDetails('FORBIDDEN', 'private detail')).toBeNull()
    expect(processRuntimeFieldKeyFromRpcDetails('REQUIRED_FORM_FIELD', ['unsafe', String.fromCharCode(10), 'key'].join(''))).toBeNull()
  })

  it('returns only the validation field key through the guarded action error response', async () => {
    const response = processRuntimeErrorResponse(new ProcessRuntimeError('REQUIRED_FORM_FIELD', 400, 'REQUIRED_FORM_FIELD', 'high_cost_reason'))
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({ code: 'REQUIRED_FORM_FIELD', fieldKey: 'high_cost_reason' })
  })

  it('does not expose arbitrary database text as a stable client code', () => {
    expect(processRuntimeErrorCodeFromMessage('secret connection detail')).toBe('PROCESS_WORK_ITEM_OPERATION_FAILED')
  })
})
