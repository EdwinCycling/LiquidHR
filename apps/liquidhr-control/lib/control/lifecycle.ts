export const TENANT_LIFECYCLE_STATUSES = [
  'PROVISIONING',
  'ACTIVE',
  'PAUSED',
  'TERMINATING',
  'TERMINATED',
] as const

export type TenantLifecycleStatus = typeof TENANT_LIFECYCLE_STATUSES[number]
export type TenantLifecycleTarget = Exclude<TenantLifecycleStatus, 'PROVISIONING'>

const ALLOWED_TRANSITIONS: Readonly<Record<TenantLifecycleStatus, readonly TenantLifecycleTarget[]>> = {
  PROVISIONING: ['ACTIVE', 'TERMINATING'],
  ACTIVE: ['PAUSED', 'TERMINATING'],
  PAUSED: ['ACTIVE', 'TERMINATING'],
  TERMINATING: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
}

export function canTransitionTenant(
  current: TenantLifecycleStatus,
  requested: TenantLifecycleStatus,
): boolean {
  return (ALLOWED_TRANSITIONS[current] as readonly TenantLifecycleStatus[]).includes(requested)
}

export function allowedTenantTransitions(
  current: TenantLifecycleStatus,
): readonly TenantLifecycleTarget[] {
  return ALLOWED_TRANSITIONS[current]
}

export function lifecycleKeepsApplicationActive(status: TenantLifecycleStatus): boolean {
  return status === 'ACTIVE'
}
