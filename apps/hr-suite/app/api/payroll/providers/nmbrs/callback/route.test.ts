import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('excluded Nmbrs OAuth callback route', () => {
  it('does not consume OAuth state or exchange an authorization code', async () => {
    const response = GET()

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: 'PAYROLL_EXTERNAL_INTEGRATION_DISABLED' })
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
