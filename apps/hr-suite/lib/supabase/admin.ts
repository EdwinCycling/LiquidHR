import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@scope/db'

export type AdminCredentialMode = 'supabase-secret-key' | 'legacy-service-role-jwt' | 'unknown-key-format'

export function getAdminCredentialMode(): AdminCredentialMode {
  const key = process.env.SUPABASE_SECRET_KEY
  if (key?.startsWith('sb_secret_')) return 'supabase-secret-key'
  if (key && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(key)) {
    return 'legacy-service-role-jwt'
  }
  return 'unknown-key-format'
}

export function createServiceRoleRpcFetch(fetchImplementation: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    headers.delete('authorization')
    headers.delete('cookie')

    return fetchImplementation(input, { ...init, headers })
  }
}

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

/**
 * Isolated server-only client for the consent-time client-registration RPC.
 * The Supabase API key is sent as `apikey`; no user session, bearer token, or
 * cookie is allowed to reach PostgREST from this client.
 */
export function createAdminRpcClient(fetchImplementation: typeof fetch = fetch) {
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
      global: {
        fetch: createServiceRoleRpcFetch(fetchImplementation),
      },
    },
  )
}
