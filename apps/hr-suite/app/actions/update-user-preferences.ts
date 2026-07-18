'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE } from '@/lib/i18n/config'
import {
  THEME_COOKIE,
  type UserPreferences,
  userPreferencesSchema,
} from '@/lib/preferences/user-preferences'
import { createClient } from '@/lib/supabase/server'

export interface PreferencesActionState {
  code: 'idle' | 'saved' | 'invalid' | 'unauthenticated' | 'failed'
  preferences?: UserPreferences
}

export async function updateUserPreferences(
  _previousState: PreferencesActionState,
  formData: FormData,
): Promise<PreferencesActionState> {
  const parsed = userPreferencesSchema.safeParse({
    locale: formData.get('locale'),
    theme: formData.get('theme'),
    clockMode: formData.get('clockMode'),
    analogClockStyle: formData.get('analogClockStyle'),
    dateFormat: formData.get('dateFormat'),
    timeFormat: formData.get('timeFormat'),
  })
  if (!parsed.success) return { code: 'invalid' }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (!userId) return { code: 'unauthenticated' }

  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    locale: parsed.data.locale,
    theme: parsed.data.theme,
    clock_mode: parsed.data.clockMode,
    analog_clock_style: parsed.data.analogClockStyle,
    date_format: parsed.data.dateFormat,
    time_format: parsed.data.timeFormat,
  })
  if (error) return { code: 'failed' }

  const cookieStore = await cookies()
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
  cookieStore.set(LOCALE_COOKIE, parsed.data.locale, options)
  cookieStore.set(THEME_COOKIE, parsed.data.theme, options)

  return { code: 'saved', preferences: parsed.data }
}
