import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('excluded Nmbrs OAuth authorization route', () => {
  it('fails closed without creating connection state or redirecting externally', async () => {
    const response = GET()

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: 'PAYROLL_EXTERNAL_INTEGRATION_DISABLED' })
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
