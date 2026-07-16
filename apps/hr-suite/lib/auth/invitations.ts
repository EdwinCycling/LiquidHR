import { randomBytes } from 'node:crypto'
import {
  buildInvitationRedirectUrl,
  type CreatedInvitation,
  type CreateInvitationInput,
  hashInvitationToken,
  InvitationError,
  normalizeInvitationEmail,
  validateInvitationRules,
} from '@/lib/auth/invitation-rules'
import { requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
  const rules = validateInvitationRules(input)
  if (!rules.ok) throw new InvitationError(rules.code, 400)

  const auth = await requirePermission('user:invite')
  const email = normalizeInvitationEmail(input.email)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (48 * 60 * 60 * 1000)).toISOString()
  const supabase = await createClient()

  const { data: invitation, error: insertError } = await supabase
    .from('user_invitations')
    .insert({
      tenant_id: auth.tenantId,
      administration_id: input.administrationId,
      employee_id: input.employeeId,
      management_role_id: input.managementRoleId,
      scope_type: input.scopeType,
      email,
      email_kind: input.emailKind,
      purpose: input.purpose,
      token_hash: hashInvitationToken(token),
      expires_at: expiresAt,
      invited_by_user_id: auth.userId,
    })
    .select('id, expires_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      throw new InvitationError('INVITATION_ALREADY_PENDING', 409)
    }
    throw new InvitationError('INVITATION_CREATE_FAILED', 400)
  }

  try {
    const admin = createAdminClient()
    const redirectTo = buildInvitationRedirectUrl(input.origin, token)
    const { error: deliveryError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (deliveryError) throw deliveryError
  } catch {
    await supabase
      .from('user_invitations')
      .update({ status: 'REVOKED' })
      .eq('id', invitation.id)

    throw new InvitationError('INVITATION_DELIVERY_FAILED', 502)
  }

  return { id: invitation.id, expiresAt: invitation.expires_at }
}
