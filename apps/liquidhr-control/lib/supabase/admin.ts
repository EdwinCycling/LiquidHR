import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { ControlDatabase } from './database'

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) throw new Error('CONTROL_ADMIN_ENVIRONMENT_NOT_CONFIGURED')

  return createClient<ControlDatabase>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
