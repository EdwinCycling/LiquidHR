import { describe, expect, it } from 'vitest'
import { databaseUuid } from './database-uuid'

describe('databaseUuid', () => {
  it('accepteert canonieke PostgreSQL UUIDs zonder RFC-label', () => {
    expect(databaseUuid.safeParse('4a3f96c5-45db-2cd9-5aff-971eee7eab44').success).toBe(true)
  })

  it('weigert niet-canonieke UUID-waarden', () => {
    expect(databaseUuid.safeParse('not-a-uuid').success).toBe(false)
  })
})
