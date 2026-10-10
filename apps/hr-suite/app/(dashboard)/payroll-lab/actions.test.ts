import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { redirect } from 'next/navigation'
import { runCaoBench02PayrollAction, runSyntheticPayrollAction } from './actions'

const { requirePermission, resolvePayrollLabAdministration, runSyntheticPayroll, runCaoBench02Payroll } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  resolvePayrollLabAdministration: vi.fn(),
  runSyntheticPayroll: vi.fn(),
  runCaoBench02Payroll: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requirePermission,
}))

vi.mock('@/lib/payroll/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payroll/access')>()),
  resolvePayrollLabAdministration,
}))

vi.mock('@/lib/payroll/synthetic-calculation-service', () => ({
  runSyntheticPayroll,
  SyntheticPayrollServiceError: class SyntheticPayrollServiceError extends Error {
    constructor(readonly code: string, readonly runId: string | null = null) { super(code) }
  },
}))

vi.mock('@/lib/payroll/cao-bench02-calculation-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payroll/cao-bench02-calculation-service')>()),
  runCaoBench02Payroll,
}))

const hrAdminContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '20000000-0000-4000-8000-000000000005',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['salary:read', 'salary:write'],
}

describe('run synthetic Payroll Lab server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects an actor who lacks salary:write before reading the Payroll capability', async () => {
    requirePermission.mockRejectedValue(new AuthorizationError('forbidden'))

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/geen-toegang')
    expect(requirePermission).toHaveBeenCalledWith('salary:write')
    expect(resolvePayrollLabAdministration).not.toHaveBeenCalled()
    expect(runSyntheticPayroll).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('rejects a non-admin even when the actor has salary permissions', async () => {
    requirePermission.mockResolvedValue({ ...hrAdminContext, activeRoles: ['HR_MANAGER'] })
    resolvePayrollLabAdministration.mockResolvedValue(null)
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/geen-toegang')
    expect(resolvePayrollLabAdministration).toHaveBeenCalled()
    expect(runSyntheticPayroll).not.toHaveBeenCalled()
  })

  it('redirects authentication failures to login without exposing their message', async () => {
    requirePermission.mockRejectedValue(new ContextAuthenticationError())

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
    expect(runSyntheticPayroll).not.toHaveBeenCalled()
  })

  it('redirects missing active context to the no-access page', async () => {
    requirePermission.mockRejectedValue(new ContextAccessError())

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/geen-toegang')
    expect(runSyntheticPayroll).not.toHaveBeenCalled()
  })

  it('uses only the authenticated context scope and the enabled Payroll administration', async () => {
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
    requirePermission.mockResolvedValue(hrAdminContext)
    resolvePayrollLabAdministration.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000004',
      displayName: 'Synthetic Payroll Lab',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    runSyntheticPayroll.mockResolvedValue({ runId: '40000000-0000-4000-8000-000000000001' })

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/payroll-lab?run=40000000-0000-4000-8000-000000000001')
    expect(runSyntheticPayroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, '30000000-0000-4000-8000-000000000004', hrAdminContext.userId)
  })

  it('fails with a stable public code and no raw service error text', async () => {
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
    requirePermission.mockResolvedValue(hrAdminContext)
    resolvePayrollLabAdministration.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000004',
      displayName: 'Synthetic Payroll Lab',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    runSyntheticPayroll.mockRejectedValue(new Error('private database detail'))

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/payroll-lab?error=PAYROLL_CALCULATION_FAILED')
    expect(redirect).toHaveBeenCalledWith('/payroll-lab?error=PAYROLL_CALCULATION_FAILED')
  })

  it('preserves a safe service error code and validated run reference', async () => {
    const { SyntheticPayrollServiceError } = await import('@/lib/payroll/synthetic-calculation-service')
    requirePermission.mockResolvedValue(hrAdminContext)
    resolvePayrollLabAdministration.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000004',
      displayName: 'Synthetic Payroll Lab',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    runSyntheticPayroll.mockRejectedValue(new SyntheticPayrollServiceError('PAYROLL_CALCULATION_FAILED', '40000000-0000-4000-8000-000000000001'))

    await expect(runSyntheticPayrollAction()).rejects.toThrow('redirect:/payroll-lab?error=PAYROLL_CALCULATION_FAILED&run=40000000-0000-4000-8000-000000000001')
    expect(redirect).toHaveBeenCalledWith('/payroll-lab?error=PAYROLL_CALCULATION_FAILED&run=40000000-0000-4000-8000-000000000001')
  })
})

describe('run CAO-BENCH02 Payroll Lab server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function form(caseKey: string): FormData {
    const value = new FormData()
    value.set('caseKey', caseKey)
    return value
  }

  it('rejects caller supplied cases outside the fixed benchmark allowlist', async () => {
    await expect(runCaoBench02PayrollAction(form('CAO-BENCH02-CEO-OVERRIDE')))
      .rejects.toThrow('redirect:/payroll-lab/calculations?error=PAYROLL_INPUT_INVALID')
    expect(requirePermission).not.toHaveBeenCalled()
    expect(runCaoBench02Payroll).not.toHaveBeenCalled()
  })

  it('requires salary:write and the active Payroll administration before running a fixed case', async () => {
    requirePermission.mockResolvedValue(hrAdminContext)
    resolvePayrollLabAdministration.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000004',
      displayName: 'Synthetic Payroll Lab',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    runCaoBench02Payroll.mockResolvedValue({ runId: '40000000-0000-4000-8000-000000000001' })

    await expect(runCaoBench02PayrollAction(form('CAO-BENCH02-K1')))
      .rejects.toThrow('redirect:/payroll-lab/calculations?case=CAO-BENCH02-K1&run=40000000-0000-4000-8000-000000000001')
    expect(requirePermission).toHaveBeenCalledWith('salary:write')
    expect(runCaoBench02Payroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, '30000000-0000-4000-8000-000000000004', hrAdminContext.userId, 'CAO-BENCH02-K1')
  })
})
