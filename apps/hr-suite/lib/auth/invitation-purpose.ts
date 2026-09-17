import { resolveEmploymentAccessState, type EmploymentTimelineEntry } from '@/lib/focus/access-state'
import { InvitationError, type InvitationPurpose } from '@/lib/auth/invitation-rules'

export type EmployeeInvitationPurpose = Extract<InvitationPurpose, 'PREBOARDING_EMPLOYEE' | 'EMPLOYEE_ACTIVATION'>
export type EmployeeInvitationEligibilityStatus = 'ELIGIBLE' | 'EMPLOYMENT_REQUIRED'

export interface EmployeeInvitationEligibility {
  status: EmployeeInvitationEligibilityStatus
  purpose: EmployeeInvitationPurpose | null
}

export function resolveEmployeeInvitationEligibility(
  today: string,
  employments: readonly EmploymentTimelineEntry[],
): EmployeeInvitationEligibility {
  const experience = resolveEmploymentAccessState(today, employments).experience
  if (experience === 'NO_EMPLOYMENT') return { status: 'EMPLOYMENT_REQUIRED', purpose: null }
  return {
    status: 'ELIGIBLE',
    purpose: experience === 'PREBOARDING' ? 'PREBOARDING_EMPLOYEE' : 'EMPLOYEE_ACTIVATION',
  }
}

export function resolveEmployeeInvitationPurpose(
  today: string,
  employments: readonly EmploymentTimelineEntry[],
): EmployeeInvitationPurpose {
  const eligibility = resolveEmployeeInvitationEligibility(today, employments)
  if (eligibility.purpose === null) throw new InvitationError('EMPLOYMENT_REQUIRED', 400)
  return eligibility.purpose
}
