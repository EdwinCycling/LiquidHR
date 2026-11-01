import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseReadError, logDatabaseReadFailure, throwDatabaseReadError } from './database-read-error'

describe('database read errors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs only the operation and validated SQLSTATE, then throws a generic error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const databaseError = {
      code: '57014',
      message: 'private query text',
      details: 'private record details',
      hint: 'private server hint',
    }

    expect(() => throwDatabaseReadError(databaseError, 'auth.context.groupAccess'))
      .toThrow(DatabaseReadError)
    expect(log).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('[LiquidHR] Database read failed', {
      operation: 'auth.context.groupAccess',
      sqlstate: '57014',
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain('private')
  })

  it('omits malformed SQLSTATEs and unsafe operation labels from server logs', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logDatabaseReadFailure({ code: 'secret-value', message: 'private query text' }, 'operation with user data')

    expect(log).toHaveBeenCalledWith('[LiquidHR] Database read failed', {
      operation: 'database.read',
      sqlstate: 'UNKNOWN',
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain('private')
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-value')
  })
})
