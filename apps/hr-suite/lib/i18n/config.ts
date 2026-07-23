export const SUPPORTED_LOCALES = ['nl', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'nl'
export const LOCALE_COOKIE = 'liquid-locale'

export const MESSAGE_NAMESPACES = [
  'common',
  'auth',
  'navigation',
  'settings',
  'departments',
  'employees',
  'employment',
  'validation',
  'errors',
  'organization',
  'customFields',
  'reminders',
  'hera',
  'dashboard',
  'masterData',
  'documents',
  'hrCalendar',
  'starPerformers',
  'leave',
] as const

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number]
