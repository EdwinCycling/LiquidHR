import 'server-only'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getVerifiedLocalPersonaIdentity, getLocalPersonaOwnerKey, isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
export async function requireLocalFiscalOperator() {
  const host=(await headers()).get('host')
  if(!isLocalPersonaRuntime(host))notFound()
  const client=await createClient()
  const verified=await getVerifiedLocalPersonaIdentity(client)
  if(!verified||getLocalPersonaOwnerKey(host,verified.identity)!=='hr-admin')notFound()
}
