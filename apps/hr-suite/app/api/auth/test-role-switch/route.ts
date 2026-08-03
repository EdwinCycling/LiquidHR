import { NextRequest, NextResponse } from 'next/server'
import {
  getTestRoleSwitchTarget,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const HANDOFF_COOKIE = 'liquidhr-test-role-switch'

export async function POST(request: NextRequest) {
  if (!isTestRoleSwitchEnabled()) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_DISABLED' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data, error: userError } = await supabase.auth.getUser()
  const currentEmail = data.user?.email
  const formData = await request.formData()
  const target = getTestRoleSwitchTarget(String(formData.get('target') ?? ''))

  if (userError || !data.user || !isTestRoleSwitchAccount(currentEmail) || !target) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })

  if (generateError || !generated.properties.hashed_token) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_UNAVAILABLE' }, { status: 503 })
  }

  await supabase.auth.signOut()

  const callbackUrl = new URL('/auth/test-role-switch/confirm', request.url)
  const response = NextResponse.redirect(callbackUrl, { status: 303 })
  response.cookies.set(HANDOFF_COOKIE, generated.properties.hashed_token, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
