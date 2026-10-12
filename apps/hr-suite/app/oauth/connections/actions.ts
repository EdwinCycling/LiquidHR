'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isChatGptOAuthGrant, readUserOAuthGrants } from '@/lib/oauth/user-grants'
import { setManagerMcpConsentMarker } from '@/lib/workforce-tools/mcp/manager-consent-admin'
import type { OAuthGrantActionState } from './grant-state'

function isClientId(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && value === value.trim()
}

export async function revokeChatGptOAuthGrant(
  _previousState: OAuthGrantActionState,
  formData: FormData,
): Promise<OAuthGrantActionState> {
  const requestedClientId = formData.get('clientId')
  if (!isClientId(requestedClientId)) return { status: 'error' }

  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch {
    return { status: 'error' }
  }

  let userId: string | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    const subject = data?.claims?.sub
    if (!error && typeof subject === 'string' && subject.length > 0) userId = subject
  } catch {
    userId = null
  }
  if (!userId) redirect('/login?next=%2Foauth%2Fconnections')

  const currentGrants = await readUserOAuthGrants(supabase.auth.oauth)
  if (currentGrants.status !== 'ready') return { status: 'error' }

  const grant = currentGrants.grants.find((candidate) => (
    candidate.clientId === requestedClientId && isChatGptOAuthGrant(candidate)
  ))
  if (!grant) return { status: 'error' }

  if (!(await setManagerMcpConsentMarker(userId, grant.clientId, false))) return { status: 'error' }

  try {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId: grant.clientId })
    if (error) return { status: 'error' }
  } catch {
    return { status: 'error' }
  }

  const updatedGrants = await readUserOAuthGrants(supabase.auth.oauth)
  if (
    updatedGrants.status !== 'ready'
    || updatedGrants.grants.some((candidate) => candidate.clientId === grant.clientId)
  ) return { status: 'error' }

  revalidatePath('/oauth/connections')
  return { status: 'revoked', clientId: grant.clientId }
}
