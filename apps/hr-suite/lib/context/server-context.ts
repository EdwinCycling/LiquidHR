import { cookies } from 'next/headers'
import {
  buildTenantContextOptions,
  selectActiveContext,
  type ActiveContext,
} from '@/lib/context/administration-context'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_TENANT_COOKIE = 'liquid-hr-tenant'
export const ACTIVE_ADMINISTRATION_COOKIE = 'liquid-hr-administration'

export class ContextAuthenticationError extends Error {
  readonly status = 401
}

export async function loadActiveContext(userId?: string): Promise<ActiveContext> {
  const supabase = await createClient()
  let resolvedUserId = userId

  if (!resolvedUserId) {
    const { data, error } = await supabase.auth.getClaims()
    const claimUserId = data?.claims?.sub
    if (error || typeof claimUserId !== 'string') {
      throw new ContextAuthenticationError('Je bent niet ingelogd.')
    }
    resolvedUserId = claimUserId
  }

  const { data: accesses, error: accessError } = await supabase
    .from('user_access')
    .select('tenant_id, scope_type, administration_id')
    .eq('user_id', resolvedUserId)
    .eq('is_active', true)
    .limit(100)

  if (accessError) throw accessError
  const tenantIds = [...new Set(accesses.map((access) => access.tenant_id))]

  if (tenantIds.length === 0) {
    return selectActiveContext({ tenants: [] })
  }

  const [{ data: tenants, error: tenantError }, { data: administrations, error: administrationError }] =
    await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, slug, administration_mode, sharing_mode')
        .in('id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(50),
      supabase
        .from('administrations')
        .select('id, tenant_id, code, name, is_active')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(200),
    ])

  if (tenantError) throw tenantError
  if (administrationError) throw administrationError

  const tenantOptions = buildTenantContextOptions({ accesses, tenants, administrations })
  const cookieStore = await cookies()

  return selectActiveContext({
    tenants: tenantOptions,
    requestedTenantId: cookieStore.get(ACTIVE_TENANT_COOKIE)?.value,
    requestedAdministrationId: cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  })
}
