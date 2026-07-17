import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('HeRa domeinactie-concurrencycontract', () => {
  it.each([
    ['employees/employee-service.ts', 'ADDRESS_STALE_WRITE'],
    ['organization/management-service.ts', 'PLACEMENT_STALE_WRITE'],
  ])('bewaakt updated_at atomair in %s', (relativePath, errorCode) => {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
    expect(source).toContain(".eq('updated_at', expectedUpdatedAt)")
    expect(source).toContain(errorCode)
  })
})
