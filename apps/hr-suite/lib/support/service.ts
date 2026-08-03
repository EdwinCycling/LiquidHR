import 'server-only'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supportReadModelSchema, type SupportReadModel } from './schema'

export const SUPPORT_SESSION_COOKIE = 'liquidhr-support-session'

export async function getSupportReadModel(): Promise<SupportReadModel | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value
  if (!sessionId || !supportReadModelSchema.shape.sessionId.safeParse(sessionId).success) return null

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_support_read_model', {
    requested_session_id: sessionId,
  })
  if (error || !data) return null

  const parsed = supportReadModelSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
