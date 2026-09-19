import 'server-only'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getFocusHomeData, focusJourneyActionHref, focusJourneyTitle } from '@/lib/focus/service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { visibleJourneyActionHref } from './focus-view'

export async function loadFocusPage(actAsToken?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const [data, locale] = await Promise.all([getFocusHomeData({ today, actAsToken }), getLocale()])
    const t = await getTranslator('focus', locale)
    return {
      data, locale, t, today,
      journeyTitle: focusJourneyTitle(data.journey, locale),
      journeyActionHref: visibleJourneyActionHref(data, focusJourneyActionHref(data.journey)),
    }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
}

export type FocusPageData = Awaited<ReturnType<typeof loadFocusPage>>
