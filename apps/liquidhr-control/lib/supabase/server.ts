import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getControlEnvironment } from '@/lib/env'
import type { ControlDatabase } from './database'

export async function createClient() {
  const cookieStore = await cookies()
  const environment = getControlEnvironment()

  return createServerClient<ControlDatabase>(environment.supabaseUrl, environment.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components kunnen geen cookies wijzigen; proxy.ts ververst de sessie.
        }
      },
    },
  })
}
