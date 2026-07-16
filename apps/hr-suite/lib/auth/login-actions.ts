'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loginSchema, safeNextPath } from '@/lib/auth/login-rules'
import { createClient } from '@/lib/supabase/server'

export interface LoginActionState {
  code: 'idle' | 'invalidCredentials' | 'providerUnavailable' | 'resetRequested'
}

async function getAppOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return new URL(process.env.NEXT_PUBLIC_APP_URL).origin
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'

  if (host && (protocol === 'https' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:'))) {
    return `${protocol}://${host}`
  }

  return 'http://localhost:3000'
}

export async function signInWithPassword(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  })

  if (!parsed.success) return { code: 'invalidCredentials' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return { code: 'invalidCredentials' }
  redirect(safeNextPath(parsed.data.next))
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(String(formData.get('next') ?? ''))
  const callbackUrl = new URL('/auth/callback', await getAppOrigin())
  callbackUrl.searchParams.set('next', next)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl.toString() },
  })

  if (error || !data.url) {
    redirect(`/login?error=provider&next=${encodeURIComponent(next)}`)
  }

  redirect(data.url)
}

export async function requestPasswordReset(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const parsedEmail = zEmail.safeParse(email)
  if (!parsedEmail.success) return { code: 'resetRequested' }

  const resetUrl = new URL('/auth/reset-password', await getAppOrigin())
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
    redirectTo: resetUrl.toString(),
  })

  return { code: 'resetRequested' }
}

const zEmail = loginSchema.shape.email
