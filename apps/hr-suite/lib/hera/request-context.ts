import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'

export async function requireHeRaContext(): Promise<AuthContext> {
  return requireAuthContext()
}
