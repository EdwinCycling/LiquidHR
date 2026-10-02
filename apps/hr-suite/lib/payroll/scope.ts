import type { AuthContext } from '@/lib/auth/permissions'

export interface PayrollScope {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string
}

export class PayrollScopeError extends Error {
  constructor() {
    super('A complete Payroll Lab scope is required.')
    this.name = 'PayrollScopeError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function payrollScopeFromAuthContext(
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'administrationId'>,
): PayrollScope | null {
  if (!isUuid(context.tenantId) || !isUuid(context.hrGroupId) || !isUuid(context.administrationId)) return null
  return {
    tenantId: context.tenantId,
    hrGroupId: context.hrGroupId,
    administrationId: context.administrationId,
  }
}

export function assertPayrollScope(scope: PayrollScope): PayrollScope {
  if (!isUuid(scope.tenantId) || !isUuid(scope.hrGroupId) || !isUuid(scope.administrationId)) {
    throw new PayrollScopeError()
  }
  return scope
}

export interface PayrollScopeFilterBuilder<TSelf> {
  eq(column: string, value: string): TSelf
}

export function applyPayrollScopeFilter<TSelf extends PayrollScopeFilterBuilder<TSelf>>(
  builder: TSelf,
  scope: PayrollScope,
): TSelf {
  const validatedScope = assertPayrollScope(scope)
  return builder
    .eq('source_tenant_id', validatedScope.tenantId)
    .eq('source_hr_group_id', validatedScope.hrGroupId)
    .eq('source_administration_id', validatedScope.administrationId)
}
