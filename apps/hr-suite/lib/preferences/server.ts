import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE } from '@/lib/i18n/config'
import { ACTIVE_ADMINISTRATION_COOKIE } from '@/lib/context/server-context'
import { createClient } from '@/lib/supabase/server'
import {
  resolveUserPreferences,
  THEME_COOKIE,
  type UserPreferences,
} from './user-preferences'
import { getBrandingForAdministration } from '@/lib/settings/branding-service'

export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const cookieStore = await cookies()
  const cookiePreferences = {
    locale: cookieStore.get(LOCALE_COOKIE)?.value,
    theme: cookieStore.get(THEME_COOKIE)?.value,
    clockMode: undefined,
    analogClockStyle: undefined,
    dateFormat: undefined,
    timeFormat: undefined,
    weekNumberingSystem: undefined,
  }
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  if (!userId) return resolveUserPreferences(null, cookiePreferences)

  const { data, error } = await supabase
    .from('user_preferences')
    .select('locale, theme, use_company_theme, clock_mode, analog_clock_style, date_format, time_format, week_numbering_system')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) return resolveUserPreferences(null, cookiePreferences)
  const preferences = resolveUserPreferences(data ? {
    locale: data.locale,
    theme: data.theme,
    useCompanyTheme: data.use_company_theme,
    clockMode: data.clock_mode,
    analogClockStyle: data.analog_clock_style,
    dateFormat: data.date_format,
    timeFormat: data.time_format,
    weekNumberingSystem: data.week_numbering_system,
  } : null, cookiePreferences)
  const administrationId = cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value
  if (!administrationId) return preferences
  const { data: administration } = await supabase.from('administrations').select('tenant_id, id').eq('id', administrationId).maybeSingle()
  if (!administration) return preferences
  const branding = await getBrandingForAdministration(administration.tenant_id, administration.id)
  return { ...preferences, companyBranding: branding }
})
