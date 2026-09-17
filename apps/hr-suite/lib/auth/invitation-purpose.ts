import { resolveEmploymentAccessState, type EmploymentTimelineEntry } from '@/lib/focus/access-state'
import type { InvitationPurpose } from '@/lib/auth/invitation-rules'

export function resolveEmployeeInvitationPurpose(
  today: string,
  employments: readonly EmploymentTimelineEntry[],
): InvitationPurpose {
  return resolveEmploymentAccessState(today, employments).experience === 'PREBOARDING'
    ? 'PREBOARDING_EMPLOYEE'
    : 'EMPLOYEE_ACTIVATION'
}
