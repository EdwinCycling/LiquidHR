import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAuthCookieOptions } from './cookie-options'

describe('getAuthCookieOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('laat lokale development-cookie op HTTP werken', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    expect(getAuthCookieOptions()).toEqual({ secure: false })
  })

  it('zet Secure voor een production-origin op HTTPS', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
    expect(getAuthCookieOptions()).toEqual({ secure: true })
  })

  it('zet Secure voor een Vercel-runtime met HTTPS deploymentinformatie', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_URL', 'liquid-hr-hr-suite.vercel.app')
    expect(getAuthCookieOptions()).toEqual({ secure: true })
  })

  it('forceert geen Secure op een lokale HTTP production-build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3049')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(getAuthCookieOptions()).toEqual({ secure: false })
  })
})
