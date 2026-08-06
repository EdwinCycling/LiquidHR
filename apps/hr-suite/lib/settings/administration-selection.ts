import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ActiveContext } from '@/lib/context/administration-context'
import {
  ACTIVE_ADMINISTRATION_COOKIE,
  loadActiveContext,
} from '@/lib/context/server-context'
export {
  buildAdministrationSettingsSelectionHref,
  getPersistedAdministrationId,
  normalizeAdministrationSettingsReturnPath,
  ADMINISTRATION_SETTINGS_SELECTION_PATH,
} from './administration-selection-helpers'

import { buildAdministrationSettingsSelectionHref, getPersistedAdministrationId } from './administration-selection-helpers'

export async function requireAdministrationSettingsContext(returnTo: string): Promise<ActiveContext> {
  const context = await loadActiveContext()
  const cookieStore = await cookies()
  const persistedAdministrationId = getPersistedAdministrationId(
    context,
    cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  )

  if (!persistedAdministrationId || context.activeAdministration?.id !== persistedAdministrationId) {
    redirect(buildAdministrationSettingsSelectionHref(returnTo))
  }

  return context
}
