import type { Database } from '@scope/db'

type InvitationStatus = Database['public']['Enums']['invitation_status']

// Invitation state is deliberately separate from account/access state. BLOCKED
// is only supplied by the employee access read model; a revoked invitation is
// never converted into a blocked account.
export type InvitationLifecycleStatus = 'NOT_ACTIVATED' | 'INVITED' | 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'REVOKED'

export function resolveInvitationLifecycleStatus(input: {
  status: InvitationStatus
  expiresAt: string
  now?: string
  employeeLinked?: boolean
}): InvitationLifecycleStatus {
  if (input.status === 'ACCEPTED' && input.employeeLinked !== false) return 'ACTIVE'
  if (input.status === 'PENDING' && Date.parse(input.expiresAt) > Date.parse(input.now ?? new Date().toISOString())) return 'INVITED'
  if (input.status === 'EXPIRED' || (input.status === 'PENDING' && Date.parse(input.expiresAt) <= Date.parse(input.now ?? new Date().toISOString()))) return 'EXPIRED'
  if (input.status === 'REVOKED') return 'REVOKED'
  return 'NOT_ACTIVATED'
}

export function canResendInvitation(input: {
  status: InvitationStatus
  employeeLinked: boolean
}): boolean {
  return input.status !== 'ACCEPTED' && !input.employeeLinked
}
