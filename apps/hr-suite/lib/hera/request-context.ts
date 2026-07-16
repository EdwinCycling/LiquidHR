import { AuthenticationError, type AuthContext } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { createClient } from '@/lib/supabase/server'

export async function requireHeRaContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || typeof userId !== 'string') throw new AuthenticationError('Je bent niet ingelogd.')
  const activeContext = await loadActiveContext(userId)
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', activeContext.tenant.id)
    .eq('auth_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (employeeError) throw employeeError
  return {
    tenantId: activeContext.tenant.id,
    administrationId: activeContext.administration?.id ?? null,
    userId,
    employeeId: employee?.id ?? null,
    activeRoles: [],
    permissions: [],
  }
}
