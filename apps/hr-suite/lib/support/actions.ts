'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SUPPORT_SESSION_COOKIE } from './service'

export async function endSupportSession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value
  if (sessionId) {
    const supabase = await createClient()
    await supabase.rpc('end_platform_support_session', {
      requested_session_id: sessionId,
    })
  }
  cookieStore.delete(SUPPORT_SESSION_COOKIE)
  const controlAppOrigin = (process.env.NEXT_PUBLIC_CONTROL_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  redirect(`${controlAppOrigin}/dashboard`)
}
