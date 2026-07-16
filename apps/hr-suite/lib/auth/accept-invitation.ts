import 'server-only'

import {
  invitationAcceptanceSchema,
  mapInvitationDatabaseError,
  type InvitationAcceptanceInput,
} from '@/lib/auth/invitation-acceptance-rules'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type AcceptInvitationResult =
  | { ok: true; tenantId: string; employeeId: string | null }
  | {
      ok: false
      code:
        | 'invalidInput'
        | 'notAuthenticated'
        | 'passwordRejected'
        | 'configuration'
        | ReturnType<typeof mapInvitationDatabaseError>
    }

export async function acceptInvitation(
  input: InvitationAcceptanceInput,
): Promise<AcceptInvitationResult> {
  const parsed = invitationAcceptanceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'invalidInput' }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  const email = claimsData?.claims?.email

  if (claimsError || !userId || typeof email !== 'string') {
    return { ok: false, code: 'notAuthenticated' }
  }

  if (parsed.data.password) {
    const { error: passwordError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })
    if (passwordError) return { ok: false, code: 'passwordRejected' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, code: 'configuration' }
  }

  const { data, error } = await admin.rpc('accept_user_invitation', {
    invitation_token: parsed.data.token,
    accepted_user_id: userId,
    accepted_email: email,
  })

  if (error || !data?.[0]) {
    return { ok: false, code: mapInvitationDatabaseError(error?.message ?? '') }
  }

  return {
    ok: true,
    tenantId: data[0].tenant_id,
    employeeId: data[0].employee_id ?? null,
  }
}
