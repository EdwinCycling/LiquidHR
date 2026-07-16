'use server'

import { redirect } from 'next/navigation'
import { acceptInvitation } from '@/lib/auth/accept-invitation'

export type InvitationActionCode =
  | 'idle'
  | 'invalidInput'
  | 'notAuthenticated'
  | 'passwordRejected'
  | 'configuration'
  | 'expired'
  | 'emailMismatch'
  | 'invalid'
  | 'employeeAlreadyLinked'
  | 'unknown'

export interface InvitationActionState {
  code: InvitationActionCode
}

export async function acceptInvitationAction(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const passwordValue = String(formData.get('password') ?? '')
  const result = await acceptInvitation({
    token: String(formData.get('token') ?? ''),
    password: passwordValue.length > 0 ? passwordValue : undefined,
  })

  if (!result.ok) return { code: result.code }
  redirect('/departments')
}
