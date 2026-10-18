const SAFE_SQLSTATE = /^[A-Z0-9]{5}$/
const SAFE_OPERATION = /^[A-Za-z0-9_.-]{1,80}$/

export class DatabaseReadError extends Error {
  constructor() {
    super('DATABASE_READ_FAILED')
    this.name = 'DatabaseReadError'
  }
}

export function logDatabaseReadFailure(error: unknown, operation: string): void {
  let sqlstate = 'UNKNOWN'
  try {
    const candidate = error && typeof error === 'object'
      ? (error as { code?: unknown }).code
      : undefined
    if (typeof candidate === 'string' && SAFE_SQLSTATE.test(candidate)) sqlstate = candidate
  } catch {
    // Error objects from clients are expected to be plain data, but logging
    // must remain safe even if a custom object has throwing property access.
  }

  const safeOperation = SAFE_OPERATION.test(operation) ? operation : 'database.read'
  console.error('[LiquidHR] Database read failed', { operation: safeOperation, sqlstate })
}

export function throwDatabaseReadError(error: unknown, operation: string): never {
  logDatabaseReadFailure(error, operation)
  throw new DatabaseReadError()
}
