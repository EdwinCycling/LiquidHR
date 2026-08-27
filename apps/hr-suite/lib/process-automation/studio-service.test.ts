import { describe, expect, it } from 'vitest'
import { studioRpcErrorCode } from './studio-service'

describe('Studio RPC error mapping', () => {
  it('maps Postgres serialization conflicts to the Studio revision conflict contract', () => {
    expect(studioRpcErrorCode({ code: '40001', message: 'could not serialize access due to concurrent update' })).toBe('PROCESS_DEFINITION_DRAFT_CONFLICT')
  })

  it('preserves explicit RPC business codes', () => {
    expect(studioRpcErrorCode({ code: 'P0001', message: 'PROCESS_DEFINITION_NOT_FOUND' })).toBe('PROCESS_DEFINITION_NOT_FOUND')
  })
})
