import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { PayrollAdministrationCapability, PayrollRepository } from './repository'
import {
  PayrollLabUnavailableError,
  resolvePayrollLabAdministration,
  updatePayrollLabAdministrationCapability,
} from './access'

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: vi.fn(),
}))
const { createRepositoryMock } = vi.hoisted(() => ({ createRepositoryMock: vi.fn() }))
vi.mock('./repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./repository')>()),
  createPayrollRepository: createRepositoryMock,
}))
import { requirePermission } from '@/lib/auth/permissions'

const context: AuthContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  hrGroupId: '22222222-2222-4222-8222-222222222222',
  administrationId: '33333333-3333-4333-8333-333333333333',
  userId: '44444444-4444-4444-8444-444444444444',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['salary:read'],
}

const enabledAdministration = {
  id: '55555555-5555-4555-8555-555555555555',
  displayName: 'Payroll Lab test administration',
  capabilityEnabled: true,
  status: 'ACTIVE' as const,
}

function makeRepository(result: PayrollAdministrationCapability | null = enabledAdministration): PayrollRepository {
  return {
    getPayrollAdministration: vi.fn().mockResolvedValue(result),
    setPayrollAdministrationCapability: vi.fn().mockResolvedValue(result),
  }
}

describe('Payroll Lab administration capability', () => {
  beforeEach(() => {
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
    vi.mocked(requirePermission).mockResolvedValue(context)
    createRepositoryMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('denies a non-admin with salary permissions before querying Payroll Lab', async () => {
    const repository = makeRepository()
    const manager = { ...context, activeRoles: ['DIRECT_MANAGER'], permissions: ['salary:read', 'salary:write'] }
    expect(await resolvePayrollLabAdministration(manager, { repository })).toBeNull()
    vi.mocked(requirePermission).mockResolvedValue(manager)
    expect(await updatePayrollLabAdministrationCapability(true, { repository })).toBeNull()
    expect(repository.getPayrollAdministration).not.toHaveBeenCalled()
    expect(repository.setPayrollAdministrationCapability).not.toHaveBeenCalled()
  })

  it('allows an authorized, enabled administration only when the global flag is on', async () => {
    const repository = makeRepository()
    await expect(resolvePayrollLabAdministration(context, { repository })).resolves.toEqual(enabledAdministration)
    expect(repository.getPayrollAdministration).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      hrGroupId: context.hrGroupId,
      administrationId: context.administrationId,
    })
  })

  it('does not construct the Payroll repository when the kill switch is off', async () => {
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'false')
    await expect(resolvePayrollLabAdministration(context)).resolves.toBeNull()
    expect(createRepositoryMock).not.toHaveBeenCalled()
  })

  it('denies a context without the existing salary-read permission or a selected administration', async () => {
    const repository = makeRepository()
    await expect(resolvePayrollLabAdministration({ ...context, permissions: [] }, { repository })).resolves.toBeNull()
    await expect(resolvePayrollLabAdministration({ ...context, administrationId: null }, { repository })).resolves.toBeNull()
    expect(repository.getPayrollAdministration).not.toHaveBeenCalled()
  })

  it.each([
    { ...enabledAdministration, capabilityEnabled: false },
    { ...enabledAdministration, status: 'SUSPENDED' as const },
    null,
  ])('denies a missing or inactive Payroll Lab administration capability', async (administration) => {
    const repository = makeRepository(administration)
    await expect(resolvePayrollLabAdministration(context, { repository })).resolves.toBeNull()
  })

  it('fails closed when the Payroll repository cannot be reached', async () => {
    const repository = makeRepository()
    repository.getPayrollAdministration = vi.fn().mockRejectedValue(new Error('database unavailable'))
    await expect(resolvePayrollLabAdministration(context, { repository })).rejects.toBeInstanceOf(PayrollLabUnavailableError)
  })

  it('updates capability only through salary:write and derives scope and actor from authenticated context', async () => {
    const repository = makeRepository()
    vi.mocked(requirePermission).mockResolvedValue({ ...context, permissions: ['salary:write'] })
    await expect(updatePayrollLabAdministrationCapability(
      true,
      { repository },
    )).resolves.toEqual(enabledAdministration)
    expect(requirePermission).toHaveBeenCalledWith('salary:write')
    expect(repository.getPayrollAdministration).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      hrGroupId: context.hrGroupId,
      administrationId: context.administrationId,
    })
    expect(repository.setPayrollAdministrationCapability).toHaveBeenCalledWith(
      {
        tenantId: context.tenantId,
        hrGroupId: context.hrGroupId,
        administrationId: context.administrationId,
      },
      enabledAdministration.id,
      true,
      context.userId,
    )
  })

  it('rejects capability mutation without salary:write or Payroll Lab enabled', async () => {
    const repository = makeRepository()
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error('forbidden'))
    await expect(updatePayrollLabAdministrationCapability(
      false,
      { repository },
    )).rejects.toThrow('forbidden')
    expect(requirePermission).toHaveBeenCalledWith('salary:write')
    vi.mocked(requirePermission).mockResolvedValue({ ...context, permissions: ['salary:write'] })
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'false')
    await expect(updatePayrollLabAdministrationCapability(
      false,
      { repository },
    )).resolves.toBeNull()
    expect(repository.getPayrollAdministration).not.toHaveBeenCalled()
    expect(repository.setPayrollAdministrationCapability).not.toHaveBeenCalled()
  })

  it('does not update a missing or non-active administration', async () => {
    const repository = makeRepository({ ...enabledAdministration, status: 'SUSPENDED' })
    vi.mocked(requirePermission).mockResolvedValue({ ...context, permissions: ['salary:write'] })

    await expect(updatePayrollLabAdministrationCapability(true, { repository })).resolves.toBeNull()
    expect(repository.getPayrollAdministration).toHaveBeenCalledOnce()
    expect(repository.setPayrollAdministrationCapability).not.toHaveBeenCalled()
  })
})
