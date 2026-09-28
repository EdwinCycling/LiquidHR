import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { deliverFirstAdminInvitation, type FirstAdminDeliveryResult } from './invitation-delivery'

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

async function getHrSuiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_HR_APP_URL) return new URL(process.env.NEXT_PUBLIC_HR_APP_URL).origin
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  return host ? `${protocol}://${host.replace(/:3001$/, ':3000')}` : 'http://localhost:3000'
}

export type BootstrapFirstAdminResult = {
  invitationId: string
  expiresAt: string
  reused: boolean
  delivery: FirstAdminDeliveryResult
}

export async function bootstrapFirstAdmin(input: { tenantId: string; hrGroupId: string; administrationId: string; email: string }): Promise<BootstrapFirstAdminResult> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString()
  const requestKey = createHash('sha256').update(`${input.tenantId}:${input.hrGroupId}:${input.administrationId}:${input.email.trim().toLowerCase()}`, 'utf8').digest('hex')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('bootstrap_platform_first_admin', {
    requested_tenant_id: input.tenantId,
    requested_hr_group_id: input.hrGroupId,
    requested_administration_id: input.administrationId,
    requested_email: input.email.trim().toLowerCase(),
    requested_token_hash: hashInvitationToken(token),
    requested_expires_at: expiresAt,
    requested_request_key: requestKey,
  })
  if (error || !data) throw new Error(error?.message ?? 'FIRST_ADMIN_BOOTSTRAP_FAILED')

  if (data.reused) {
    return {
      invitationId: data.invitationId,
      expiresAt: data.expiresAt,
      reused: true,
      delivery: { mode: 'EMAIL', invitationUrl: null },
    }
  }

  try {
    const delivery = await deliverFirstAdminInvitation({ email: input.email.trim().toLowerCase(), token, origin: await getHrSuiteOrigin() })
    return { invitationId: data.invitationId, expiresAt: data.expiresAt, reused: false, delivery }
  } catch {
    await supabase.rpc('revoke_platform_first_admin_invitation', {
      requested_invitation_id: data.invitationId,
      requested_reason: 'Uitnodigingsbezorging mislukt; bootstrap opnieuw uitvoeren na herstel.',
    })
    throw new Error('FIRST_ADMIN_INVITATION_DELIVERY_FAILED')
  }
}
