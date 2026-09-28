import 'server-only'

import { buildInvitationRedirectUrl } from './invitation-url'
import { createAdminClient } from '@/lib/supabase/admin'

export type InvitationDeliveryMode = 'EMAIL' | 'TEST_CAPTURE'

export type FirstAdminDeliveryResult =
  | { mode: 'EMAIL'; invitationUrl: null }
  | { mode: 'TEST_CAPTURE'; invitationUrl: string }

export function configuredInvitationDelivery(): InvitationDeliveryMode {
  const configured = process.env.LIQUIDHR_INVITATION_DELIVERY === 'TEST_CAPTURE' ? 'TEST_CAPTURE' : 'EMAIL'
  const testCaptureAllowed = process.env.LIQUIDHR_TEST_CAPTURE_ENABLED === 'true'
    && process.env.NODE_ENV !== 'production'
    && !process.env.VERCEL_ENV
  return configured === 'TEST_CAPTURE' && testCaptureAllowed ? 'TEST_CAPTURE' : 'EMAIL'
}

export async function deliverFirstAdminInvitation(input: { email: string; token: string; origin: string }): Promise<FirstAdminDeliveryResult> {
  const redirectUrl = buildInvitationRedirectUrl(input.origin, input.token)
  if (configuredInvitationDelivery() === 'TEST_CAPTURE') {
    return { mode: 'TEST_CAPTURE', invitationUrl: redirectUrl }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo: redirectUrl })
  if (error) throw new Error('INVITATION_EMAIL_DELIVERY_FAILED')
  return { mode: 'EMAIL', invitationUrl: null }
}
