import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, exchangeCodeForSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    createClient.mockReset()
    exchangeCodeForSession.mockReset()
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession } })
  })

  it('wisselt de code uit en redirect via de oorspronkelijke publieke host', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const request = new NextRequest(
      'https://internal.vercel.app/auth/callback?code=oauth-code&next=%2Femployees%3Fview%3Dcards',
      {
        headers: {
          'x-forwarded-host': 'liquid-hr-hr-suite.vercel.app',
          'x-forwarded-proto': 'https',
        },
      },
    )

    const response = await GET(request)

    expect(exchangeCodeForSession).toHaveBeenCalledWith('oauth-code')
    expect(response.headers.get('location')).toBe(
      'https://liquid-hr-hr-suite.vercel.app/employees?view=cards',
    )
  })

  it('stuurt een callbackfout terug naar login met behoud van de veilige bestemming', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('PKCE mislukt') })
    const request = new NextRequest(
      'https://internal.vercel.app/auth/callback?code=oauth-code&next=%2Fdashboard%2Fstart',
      { headers: { 'x-forwarded-host': 'liquid-hr-hr-suite.vercel.app' } },
    )

    const response = await GET(request)

    expect(response.headers.get('location')).toBe(
      'https://liquid-hr-hr-suite.vercel.app/login?error=auth&next=%2Fdashboard%2Fstart',
    )
  })

  it('weigert een callback zonder code voordat Supabase wordt aangeroepen', async () => {
    const request = new NextRequest(
      'https://internal.vercel.app/auth/callback?next=%2Fdashboard%2Fstart',
      { headers: { 'x-forwarded-host': 'liquid-hr-hr-suite.vercel.app' } },
    )

    const response = await GET(request)

    expect(createClient).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://liquid-hr-hr-suite.vercel.app/login?error=auth&next=%2Fdashboard%2Fstart',
    )
  })
})
