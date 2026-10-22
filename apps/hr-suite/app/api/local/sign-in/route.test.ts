import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getPassword: vi.fn(),
  getEmail: vi.fn(),
  getPasswordEnvironmentKey: vi.fn(),
  isPersonaKey: vi.fn(),
  verifyPersona: vi.fn(),
  clearContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/context/context-cookies', () => ({
  ACTIVE_ADMINISTRATION_COOKIE: 'active-administration',
  ACTIVE_HR_GROUP_COOKIE: 'active-hr-group',
  ACTIVE_TENANT_COOKIE: 'active-tenant',
  clearActiveContextCookies: mocks.clearContext,
}))
vi.mock('@/lib/auth/local-test-personas', () => ({
  getLocalTestPersonaPassword: mocks.getPassword,
  getLocalTestPersonaEmail: mocks.getEmail,
  getLocalTestPersonaPasswordEnvironmentKey: mocks.getPasswordEnvironmentKey,
  isLocalTestPersonaKey: mocks.isPersonaKey,
  verifyLocalTestPersonaIdentity: mocks.verifyPersona,
}))
import { POST } from './route'

function request(account = 'hr-admin', host = '127.0.0.1:3011', origin = 'http://' + host) {
  return new NextRequest('http://' + host + '/api/local/sign-in', {
    method: 'POST',
    headers: { host, origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ account }),
  })
}

describe('local existing TEST persona sign-in', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } })
    mocks.signIn.mockResolvedValue({ error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.getPassword.mockReturnValue(String.fromCharCode(120))
    mocks.getEmail.mockImplementation((key: string) => ({
      'hr-admin': 'hradmin.fixture@liquidhr.test',
      manager: 'manager.fixture@liquidhr.test',
      employee: 'employee.fixture@liquidhr.test',
    })[key])
    mocks.getPasswordEnvironmentKey.mockImplementation((key: string) => ({
      'hr-admin': 'TALENT_HR_ADMIN_PASSWORD',
      manager: 'TALENT_MANAGER_PASSWORD',
      employee: 'TALENT_EMPLOYEE_PASSWORD',
    })[key])
    mocks.isPersonaKey.mockImplementation((value: unknown) => ['hr-admin', 'manager', 'employee'].includes(String(value)))
    mocks.verifyPersona.mockResolvedValue({
      userId: 'verified-user',
      tenantId: 'tenant-verified',
      hrGroupId: 'group-verified',
      employeeId: null,
      activeRoles: ['TENANT_ADMIN'],
    })
  })

  it.each([
    ['hr-admin', 'hradmin.fixture@liquidhr.test'],
    ['manager', 'manager.fixture@liquidhr.test'],
    ['employee', 'employee.fixture@liquidhr.test'],
  ])('uses normal password authentication for the fixed %s identity', async (account, email) => {
    const response = await POST(request(account))

    expect(response.status).toBe(303)
    expect(mocks.signIn).toHaveBeenCalledWith({
      email,
      password: expect.any(String),
    })
    expect(mocks.verifyPersona).toHaveBeenCalledWith(expect.anything(), account)
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3011/dashboard/start')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.cookies.get('active-tenant')?.value).toBe('tenant-verified')
    expect(response.cookies.get('active-hr-group')?.value).toBe('group-verified')
    expect(await response.text()).not.toContain(String.fromCharCode(120))
  })

  it('rejects malformed and unapproved persona selections before authentication', async () => {
    expect((await POST(request('payroll-lisa'))).status).toBe(400)
    const duplicate = new NextRequest('http://127.0.0.1:3011/api/local/sign-in', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3011',
        origin: 'http://127.0.0.1:3011',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams([['account', 'manager'], ['account', 'employee']]),
    })
    expect((await POST(duplicate)).status).toBe(400)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it.each(['VERCEL', 'VERCEL_ENV'])('rejects hosted environments through %s', async (key) => {
    vi.stubEnv(key, 'production')

    expect((await POST(request())).status).toBe(404)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('rejects non-loopback hosts and cross-origin requests before authentication', async () => {
    expect((await POST(request('manager', '192.168.1.10:3011'))).status).toBe(404)
    expect((await POST(request('manager', '127.0.0.1:3011', 'https://external.example'))).status).toBe(403)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it.each([
    ['hr-admin', 'TALENT_HR_ADMIN_PASSWORD'],
    ['manager', 'TALENT_MANAGER_PASSWORD'],
    ['employee', 'TALENT_EMPLOYEE_PASSWORD'],
  ])('reports only the missing managed variable for %s', async (account, variable) => {
    mocks.getPassword.mockReturnValue(undefined)

    const response = await POST(request(account))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'LOCAL_SIGN_IN_UNAVAILABLE', missing: variable })
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('does not continue when Supabase rejects password authentication', async () => {
    mocks.signIn.mockResolvedValue({ error: { code: 'invalid_credentials' } })

    expect((await POST(request('manager'))).status).toBe(401)
    expect(mocks.verifyPersona).not.toHaveBeenCalled()
  })

  it('signs out a session when the selected identity fails server-side role or scope verification', async () => {
    mocks.verifyPersona.mockResolvedValue(null)

    expect((await POST(request('employee'))).status).toBe(403)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.clearContext).toHaveBeenCalled()
  })

  it('fails closed when server-side role verification errors', async () => {
    mocks.verifyPersona.mockRejectedValue(new Error('private context detail'))

    expect((await POST(request('manager'))).status).toBe(503)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.clearContext).toHaveBeenCalled()
  })

  it('fails closed if local Supabase sign-out cannot clean a rejected session', async () => {
    mocks.verifyPersona.mockResolvedValue(null)
    mocks.signOut.mockResolvedValue({ error: { code: 'network_error' } })

    expect((await POST(request('employee'))).status).toBe(503)
  })
})
