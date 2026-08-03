'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export interface LoginState { code: 'idle' | 'invalid' }

const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(72) })

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { code: 'invalid' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { code: 'invalid' }
  redirect('/dashboard')
}

async function getAppOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_CONTROL_APP_URL) {
    return new URL(process.env.NEXT_PUBLIC_CONTROL_APP_URL).origin
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  return host ? `${protocol}://${host}` : 'http://localhost:3001'
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = String(formData.get('next') ?? '/dashboard')
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  const callbackUrl = new URL('/auth/callback', await getAppOrigin())
  callbackUrl.searchParams.set('next', safeNext)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl.toString() },
  })
  if (error || !data.url) redirect('/login?error=provider')
  redirect(data.url)
}
