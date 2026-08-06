import type { ActiveContext } from '@/lib/context/administration-context'

export const ADMINISTRATION_SETTINGS_SELECTION_PATH = '/settings/administration'

const ADMINISTRATION_SETTINGS_RETURN_PREFIXES = [
  '/settings',
  '/master-data',
  '/custom-fields',
  '/company-documents',
] as const

export function normalizeAdministrationSettingsReturnPath(value: string | undefined): string {
  if (!value || value.startsWith('//') || !value.startsWith('/')) return '/settings'
  if (value === ADMINISTRATION_SETTINGS_SELECTION_PATH || value.startsWith(`${ADMINISTRATION_SETTINGS_SELECTION_PATH}?`)) return '/settings'

  const isAllowed = ADMINISTRATION_SETTINGS_RETURN_PREFIXES.some((prefix) =>
    value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`),
  )
  return isAllowed ? value : '/settings'
}

export function buildAdministrationSettingsSelectionHref(returnTo: string): string {
  const safeReturnPath = normalizeAdministrationSettingsReturnPath(returnTo)
  return `${ADMINISTRATION_SETTINGS_SELECTION_PATH}?returnTo=${encodeURIComponent(safeReturnPath)}`
}

export function getPersistedAdministrationId(context: ActiveContext, cookieValue: string | undefined): string | null {
  if (!cookieValue) return null
  return context.administrationsInActiveHrGroup.some((administration) => administration.id === cookieValue)
    ? cookieValue
    : null
}
