import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE } from '@/lib/i18n/config'
import { createClient } from '@/lib/supabase/server'
import {
  resolveUserPreferences,
  THEME_COOKIE,
  type UserPreferences,
} from './user-preferences'

export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const cookieStore = await cookies()
  const cookiePreferences = {
    locale: cookieStore.get(LOCALE_COOKIE)?.value,
    theme: cookieStore.get(THEME_COOKIE)?.value,
    clockMode: undefined,
    analogClockStyle: undefined,
    dateFormat: undefined,
    timeFormat: undefined,
  }
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  if (!userId) return resolveUserPreferences(null, cookiePreferences)

  const { data, error } = await supabase
    .from('user_preferences')
    .select('locale, theme, clock_mode, analog_clock_style, date_format, time_format')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) return resolveUserPreferences(null, cookiePreferences)
  return resolveUserPreferences(data ? {
    locale: data.locale,
    theme: data.theme,
    clockMode: data.clock_mode,
    analogClockStyle: data.analog_clock_style,
    dateFormat: data.date_format,
    timeFormat: data.time_format,
  } : null, cookiePreferences)
})
