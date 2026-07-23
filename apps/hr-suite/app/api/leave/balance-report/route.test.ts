import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/leave/balance-report', () => {
  it('weigert onbekende of ongeldige queryvelden vóór authenticatie', async () => {
    const response = await GET(new Request('https://example.test/api/leave/balance-report?asOfDate=not-a-date'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })
})
