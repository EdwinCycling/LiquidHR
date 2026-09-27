import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, headers, redirect, signInWithOAuth, signInWithPassword } = vi.hoisted(() => ({
  createClient: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { signInWithGoogle, signInWithPassword as signInWithPasswordAction } from './login-actions'

describe('login actions', () => {
  beforeEach(() => {
    createClient.mockReset()
    headers.mockReset()
    redirect.mockReset()
    signInWithOAuth.mockReset()
    signInWithPassword.mockReset()
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL', '')
    headers.mockResolvedValue(new Headers({
      'x-forwarded-host': 'liquid-hr-hr-suite.vercel.app',
      'x-forwarded-proto': 'https',
      host: 'localhost:3000',
    }))
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://supabase.example/auth/v1/authorize?provider=google' },
      error: null,
    })
    signInWithPassword.mockResolvedValue({ error: null })
    createClient.mockResolvedValue({ auth: { signInWithOAuth, signInWithPassword } })
    redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`)
    })
  })

  it('houdt e-mail- en wachtwoordaanmelding op dezelfde server-side Supabase Auth-route', async () => {
    const formData = new FormData()
    formData.set('email', 'test.user@example.com')
    formData.set('password', 'SyntheticPassw0rd!')
    formData.set('next', '/dashboard/start')

    await expect(signInWithPasswordAction({ code: 'idle' }, formData)).rejects.toThrow('NEXT_REDIRECT:/dashboard/start')

    expect(createClient).toHaveBeenCalledOnce()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'test.user@example.com',
      password: 'SyntheticPassw0rd!',
    })
    expect(redirect).toHaveBeenCalledWith('/dashboard/start')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('stuurt Google terug naar de actuele localhost-origin met de veilige bestemmingsroute', async () => {
    const formData = new FormData()
    formData.set('next', '/dashboard/start')

    await expect(signInWithGoogle(formData)).rejects.toThrow('NEXT_REDIRECT:')

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard%2Fstart',
      },
    })
    expect(redirect).toHaveBeenCalledWith('https://supabase.example/auth/v1/authorize?provider=google')
  })

  it('stuurt een Google-login vanaf Vercel terug naar dezelfde Vercel-origin', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    headers.mockResolvedValue(new Headers({
      'x-forwarded-host': 'liquid-hr-hr-suite.vercel.app',
      'x-forwarded-proto': 'https',
      host: 'internal.vercel.app',
    }))
    const formData = new FormData()
    formData.set('next', '/employees?view=cards')

    await expect(signInWithGoogle(formData)).rejects.toThrow('NEXT_REDIRECT:')

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://liquid-hr-hr-suite.vercel.app/auth/callback?next=%2Femployees%3Fview%3Dcards',
      },
    })
  })

  it('laat een extern aangeleverde bestemmingsroute niet door in de Google-callback', async () => {
    const formData = new FormData()
    formData.set('next', '//attacker.example')

    await expect(signInWithGoogle(formData)).rejects.toThrow('NEXT_REDIRECT:')

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard%2Fstart',
      },
    })
  })
})
