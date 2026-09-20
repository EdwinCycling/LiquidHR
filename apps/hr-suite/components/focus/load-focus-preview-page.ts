import 'server-only'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getFocusPreviewData, focusJourneyActionHref, focusJourneyTitle } from '@/lib/focus/service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { visibleJourneyActionHref } from './focus-view'

export async function loadFocusPreviewPage(employeeId: string) {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const [data, locale] = await Promise.all([getFocusPreviewData(employeeId, { today }), getLocale()])
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

export type FocusPreviewPageData = Awaited<ReturnType<typeof loadFocusPreviewPage>>
