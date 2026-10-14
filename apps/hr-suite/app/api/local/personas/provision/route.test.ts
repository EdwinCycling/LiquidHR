import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClient,
  createAdminClient,
  getClaims,
  rpc,
  createUser,
  deleteUser,
  getLocalPayrollPersonaReadiness,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getLocalPayrollPersonaReadiness: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/auth/local-payroll-persona-readiness', () => ({
  getLocalPayrollPersonaReadiness,
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
} as const

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
    rpc.mockReset()
    createUser.mockReset()
    deleteUser.mockReset()
    getLocalPayrollPersonaReadiness.mockReset()

    getClaims.mockResolvedValue({
      data: { claims: { sub: 'verified-hr-admin-user', email: 'hradmin.fixture@liquidhr.test', email_verified: true } },
      error: null,
    })
    rpc.mockResolvedValue({ data: { status: 'LINKED', changed: true }, error: null })
    createUser.mockResolvedValue({ data: { user: { id: 'new-auth-user' } }, error: null })
    deleteUser.mockResolvedValue({ error: null })
    createClient.mockResolvedValue({ auth: { getClaims }, rpc })
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
    getLocalPayrollPersonaReadiness.mockResolvedValueOnce(readiness('payroll-jaap', 'account-required', null))
    rpc.mockResolvedValueOnce({ data: null, error: new Error('link denied') })

    const response = await POST(request('payroll-jaap'))

    expect(response.status).toBe(503)
    expect(deleteUser).toHaveBeenCalledWith('new-auth-user')
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
})
