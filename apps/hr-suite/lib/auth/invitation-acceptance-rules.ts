import { z } from 'zod'

export const invitationAcceptanceSchema = z.object({
  token: z.string().trim().min(1).max(512),
  password: z.string().min(12).max(72).optional(),
}).strict()

export type InvitationAcceptanceInput = z.infer<typeof invitationAcceptanceSchema>

export type InvitationAcceptanceFailure =
  | 'expired'
  | 'emailMismatch'
  | 'invalid'
  | 'employeeAlreadyLinked'
  | 'unknown'

export function mapInvitationDatabaseError(message: string): InvitationAcceptanceFailure {
  if (message.includes('INVITATION_EXPIRED')) return 'expired'
  if (message.includes('INVITATION_EMAIL_MISMATCH')) return 'emailMismatch'
  if (message.includes('INVITATION_INVALID')) return 'invalid'
  if (message.includes('EMPLOYEE_ALREADY_LINKED')) return 'employeeAlreadyLinked'
  return 'unknown'
}
