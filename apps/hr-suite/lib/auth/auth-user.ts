import { createAdminClient } from '@/lib/supabase/admin'

export async function getAuthUserLastSignInAt(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user?.last_sign_in_at ?? null
}
