import 'server-only'

import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { isPayrollLabEnabled } from './feature-flag'
import {
  createPayrollRepository,
  type PayrollAdministrationCapability,
  type PayrollRepository,
} from './repository'
import { payrollScopeFromAuthContext } from './scope'

type PayrollCapabilityReader = Pick<PayrollRepository, 'getPayrollAdministration'>

export class PayrollLabUnavailableError extends Error {
  constructor() {
    super('Payroll Lab is temporarily unavailable.')
    this.name = 'PayrollLabUnavailableError'
  }
}

export interface PayrollLabAccessOptions {
  repository?: PayrollCapabilityReader
}

export async function resolvePayrollLabAdministration(
  context: AuthContext,
  options: PayrollLabAccessOptions = {},
): Promise<PayrollAdministrationCapability | null> {
  const enabled = isPayrollLabEnabled()
  if (!enabled || !context.permissions.includes('salary:read')
    || !context.activeRoles.some((role) => role === 'HR_ADMIN' || role === 'TENANT_ADMIN')) return null

  const scope = payrollScopeFromAuthContext(context)
  if (!scope) return null

  try {
    const repository = options.repository ?? createPayrollRepository()
    const administration = await repository.getPayrollAdministration(scope)
    if (!administration?.capabilityEnabled || administration.status !== 'ACTIVE') return null
    return administration
  } catch {
    throw new PayrollLabUnavailableError()
  }
}

export interface PayrollLabCapabilityUpdateOptions {
  repository?: Pick<PayrollRepository, 'getPayrollAdministration' | 'setPayrollAdministrationCapability'>
}

export async function updatePayrollLabAdministrationCapability(
  capabilityEnabled: boolean,
  options: PayrollLabCapabilityUpdateOptions = {},
): Promise<PayrollAdministrationCapability | null> {
  const context = await requirePermission('salary:write')
  if (!isPayrollLabEnabled() || !context.permissions.includes('salary:write')
    || !context.activeRoles.some((role) => role === 'HR_ADMIN' || role === 'TENANT_ADMIN')) return null

  const scope = payrollScopeFromAuthContext(context)
  if (!scope) return null

  try {
    const repository = options.repository ?? createPayrollRepository()
    const administration = await repository.getPayrollAdministration(scope)
    if (!administration || administration.status !== 'ACTIVE') return null

    return await repository.setPayrollAdministrationCapability(
      scope,
      administration.id,
      capabilityEnabled,
      context.userId,
    )
  } catch {
    throw new PayrollLabUnavailableError()
  }
}
