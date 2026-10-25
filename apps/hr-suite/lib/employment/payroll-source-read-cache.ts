import { cache } from 'react'

const getRequestScopedReads = cache(() => new Map<string, Promise<unknown>>())

/** Deduplicates an identical read only within the current server-render request. */
export function readPayrollSourceQueryCached<T>(
  key: readonly unknown[],
  read: () => PromiseLike<T>,
): Promise<T> {
  const requestReads = getRequestScopedReads()
  const cacheKey = JSON.stringify(key)
  const existing = requestReads.get(cacheKey)
  if (existing) return existing as Promise<T>

  const pending = Promise.resolve().then(read) as Promise<T>
  requestReads.set(cacheKey, pending)
  return pending
}
