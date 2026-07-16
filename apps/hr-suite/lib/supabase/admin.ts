import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@scope/db'

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SECRET_KEY is niet geconfigureerd.')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
