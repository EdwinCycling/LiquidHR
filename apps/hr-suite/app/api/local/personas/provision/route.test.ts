import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClient,
  createAdminClient,
  getClaims,
  getUser,
  rpc,
  createUser,
  deleteUser,
  getLocalPayrollPersonaReadiness,
  requireComponentLibraryAccess,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getLocalPayrollPersonaReadiness: vi.fn(),
  requireComponentLibraryAccess: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess }))
vi.mock('@/lib/auth/local-payroll-persona-readiness', () => ({
  getLocalPayrollPersonaReadiness,
  PAYFULL02_MARS_SCOPE: {
    tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
    hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
    administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
  },
  LOCAL_PAYROLL_PERSONA_RECORDS: {
    'payroll-lisa': {
      email: 'lisa.test@liquidhr.test',
      employeeId: '64ad3a23-f59a-4ed0-af41-26dda20ff067',
      employmentId: 'b7391845-77d4-407c-bfe6-555a8a3d463b',
      provisionable: false,
    },
    'payroll-jaap': {
      email: 'jaap.test@liquidhr.test',
      employeeId: 'dd9bde02-76bb-4f7c-8add-db544a148f3f',
      employmentId: '29058c73-5cfa-409d-b9d4-80dd30f36962',
      provisionable: true,
    },
    'payroll-frits': {
      email: 'frits.test@liquidhr.test',
      employeeId: '79091d14-ef66-41fe-a2d5-92df108727e5',
      employmentId: 'd19bace9-bb97-4822-a462-eed22821ed05',
      provisionable: true,
    },
    'payroll-demo-002': {
      email: 'demo-002.payroll@liquidhr.test',
      employeeId: '1620bd56-4f74-db62-9f9e-a5ce1d286bc5',
      employmentId: '6236ee34-182d-1676-6635-ad8eed4c21f3',
      provisionable: true,
      scope: {
        tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
        hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
        administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
      },
    },
  },
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

const LOCAL_ORIGIN = 'http://127.0.0.1:3010'
const targetIds = {
  'payroll-jaap': {
    employeeId: 'dd9bde02-76bb-4f7c-8add-db544a148f3f',
    employmentId: '29058c73-5cfa-409d-b9d4-80dd30f36962',
    email: 'jaap.test@liquidhr.test',
  },
  'payroll-frits': {
    employeeId: '79091d14-ef66-41fe-a2d5-92df108727e5',
    employmentId: 'd19bace9-bb97-4822-a462-eed22821ed05',
    email: 'frits.test@liquidhr.test',
  },
  'payroll-demo-002': {
    employeeId: '1620bd56-4f74-db62-9f9e-a5ce1d286bc5',
    employmentId: '6236ee34-182d-1676-6635-ad8eed4c21f3',
    email: 'demo-002.payroll@liquidhr.test',
  },
} as const
const MARS_SCOPE = {
  tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
  hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
  administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
}

function request(target: string, origin = LOCAL_ORIGIN): NextRequest {
  return new NextRequest(`${origin}/api/local/personas/provision`, {
    method: 'POST',
    headers: { origin, host: new URL(origin).host },
    body: new URLSearchParams({ target }),
  })
}

function readiness(
  key: string,
  status: 'account-required' | 'link-required' | 'first-sign-in-required' | 'available' | 'conflict' | 'unavailable',
  authUserId: string | null,
) {
  return {
    key,
    status,
    available: status === 'available',
    canStartSignIn: status === 'available' || status === 'first-sign-in-required',
    canProvision: status === 'account-required' || status === 'link-required',
    authUserId,
  }
}

describe('POST /api/local/personas/provision', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')

    createClient.mockReset()
    createAdminClient.mockReset()
    getClaims.mockReset()
    getUser.mockReset()
    rpc.mockReset()
    createUser.mockReset()
    deleteUser.mockReset()
    getLocalPayrollPersonaReadiness.mockReset()
    requireComponentLibraryAccess.mockReset()

    getClaims.mockResolvedValue({
      data: { claims: { sub: 'verified-hr-admin-user', email: 'hradmin.fixture@liquidhr.test', email_verified: true } },
      error: null,
    })
    getUser.mockResolvedValue({ data: { user: { id: 'verified-hr-admin-user', email: 'hradmin.fixture@liquidhr.test', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } }, error: null })
    rpc.mockResolvedValue({ data: { status: 'LINKED', changed: true }, error: null })
    createUser.mockResolvedValue({ data: { user: { id: 'new-auth-user' } }, error: null })
    deleteUser.mockResolvedValue({ error: null })
    createClient.mockResolvedValue({ auth: { getClaims, getUser }, rpc })
    createAdminClient.mockReturnValue({ auth: { admin: { createUser, deleteUser } } })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects hosted requests before Auth or Core calls', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')

    const response = await POST(request('payroll-jaap', 'https://payroll-preview.vercel.app'))

    expect(response.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['payroll-lisa', 'manager', 'employee', 'other'])('rejects target %s without creating an Auth user', async (target) => {
    const response = await POST(request(target))

    expect(response.status).toBe(400)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('creates only Jaap’s confirmed Auth identity, links its exact employee record, and reads back first sign-in readiness', async () => {
    const target = targetIds['payroll-jaap']
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
      .mockResolvedValueOnce(readiness('payroll-jaap', 'first-sign-in-required', 'new-auth-user'))

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${LOCAL_ORIGIN}/local/personas?linked=payroll-jaap`)
    expect(createUser).toHaveBeenCalledWith({ email: target.email, email_confirm: true })
    expect(createUser.mock.calls[0]?.[0]).not.toHaveProperty('password')
    expect(rpc).toHaveBeenCalledWith('link_local_test_payroll_persona_v1', {
      p_persona_key: 'payroll-jaap',
      p_employee_id: target.employeeId,
      p_employment_id: target.employmentId,
      p_auth_user_id: 'new-auth-user',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('location')).not.toContain('new-auth-user')
  })

  it('reuses an existing unlinked Frits Auth identity without creating a second account', async () => {
    const target = targetIds['payroll-frits']
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-frits', 'link-required', 'existing-auth-user'))
      .mockResolvedValueOnce(readiness('payroll-frits', 'first-sign-in-required', 'existing-auth-user'))

    const response = await POST(request('payroll-frits'))

    expect(response.status).toBe(303)
    expect(createUser).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('link_local_test_payroll_persona_v1', {
      p_persona_key: 'payroll-frits',
      p_employee_id: target.employeeId,
      p_employment_id: target.employmentId,
      p_auth_user_id: 'existing-auth-user',
    })
  })

  it('deletes a newly created Auth identity when the scoped Core link fails', async () => {
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
      .mockResolvedValueOnce(readiness('payroll-jaap', 'link-required', 'new-auth-user'))
    rpc.mockResolvedValueOnce({ data: null, error: new Error('link denied') })

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(503)
    expect(deleteUser).toHaveBeenCalledWith('new-auth-user')
  })

  it('keeps the Auth identity when the Core link committed despite a transport error', async () => {
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
      .mockResolvedValueOnce(readiness('payroll-jaap', 'first-sign-in-required', 'new-auth-user'))
    rpc.mockResolvedValueOnce({ data: null, error: new Error('response lost after commit') })

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${LOCAL_ORIGIN}/local/personas?linked=payroll-jaap`)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('keeps the Auth identity when Core link state cannot be read after an RPC error', async () => {
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
      .mockRejectedValueOnce(new Error('readback unavailable'))
    rpc.mockResolvedValueOnce({ data: null, error: new Error('link outcome unknown') })

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(503)
    expect(response.json()).resolves.toEqual({ error: 'LOCAL_PERSONA_LINK_STATE_UNAVAILABLE' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not delete an Auth identity after a successful Core link if post-link readback fails', async () => {
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
      .mockRejectedValueOnce(new Error('readback unavailable'))

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(503)
    expect(response.json()).resolves.toEqual({ error: 'LOCAL_PERSONA_READBACK_UNAVAILABLE' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not delete an Auth identity that existed before this action', async () => {
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-jaap', 'link-required', 'existing-auth-user'))
    rpc.mockResolvedValueOnce({ data: null, error: new Error('link denied') })

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(503)
    expect(createUser).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('requires the exact Mars payroll administration and calls only the fixed DEMO-002 Core RPC', async () => {
    const target = targetIds['payroll-demo-002']
    requireComponentLibraryAccess.mockResolvedValue({ scope: MARS_SCOPE })
    getLocalPayrollPersonaReadiness
      .mockResolvedValueOnce(readiness('payroll-demo-002', 'account-required', null))
      .mockResolvedValueOnce(readiness('payroll-demo-002', 'first-sign-in-required', 'new-auth-user'))

    const response = await POST(request('payroll-demo-002'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${LOCAL_ORIGIN}/local/personas?linked=payroll-demo-002`)
    expect(requireComponentLibraryAccess).toHaveBeenCalledWith(true)
    expect(createUser).toHaveBeenCalledWith({ email: target.email, email_confirm: true })
    expect(rpc).toHaveBeenCalledWith('link_local_test_payroll_demo_002_v1', {
      p_employee_id: target.employeeId,
      p_employment_id: target.employmentId,
      p_auth_user_id: 'new-auth-user',
    })
    expect(rpc).not.toHaveBeenCalledWith('link_local_test_payroll_persona_v1', expect.anything())
  })

  it('does not create an Auth identity when the current payroll scope is not Mars', async () => {
    requireComponentLibraryAccess.mockResolvedValue({ scope: { ...MARS_SCOPE, administrationId: 'another-administration' } })

    const response = await POST(request('payroll-demo-002'))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a different Mars admin before Auth creation because the Core link RPC accepts only the fixture operator', async () => {
    const otherMarsAdmin = 'mars.hradmin@liquidhr.test'
    getClaims.mockResolvedValueOnce({
      data: { claims: { sub: 'other-mars-admin', email: otherMarsAdmin, email_verified: true } },
      error: null,
    })
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'other-mars-admin', email: otherMarsAdmin, email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } },
      error: null,
    })
    requireComponentLibraryAccess.mockResolvedValue({ scope: MARS_SCOPE })

    const response = await POST(request('payroll-demo-002'))

    expect(response.status).toBe(403)
    expect(requireComponentLibraryAccess).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
