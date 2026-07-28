import type { Database } from '@scope/db'
import { z } from 'zod'

export const UI_THEMES = [
  'liquid-navy',
  'noordzee',
  'bos',
  'warm-zand',
  'aubergine',
  'nacht',
] as const satisfies readonly Database['public']['Enums']['ui_theme'][]
export const THEME_COOKIE = 'liquid-theme'
export const CLOCK_MODES = ['ANALOG', 'DIGITAL', 'HIDDEN'] as const
export const ANALOG_CLOCK_STYLES = ['CLASSIC', 'MINIMAL', 'LIQUID'] as const
export const DATE_FORMATS = ['DMY', 'MDY', 'YMD'] as const
export const TIME_FORMATS = ['24H', '12H'] as const
export const WEEK_NUMBERING_SYSTEMS = ['JANUARY_FIRST', 'ISO'] as const
export type ClockMode = (typeof CLOCK_MODES)[number]
export type AnalogClockStyle = (typeof ANALOG_CLOCK_STYLES)[number]
export type DateFormat = (typeof DATE_FORMATS)[number]
export type TimeFormat = (typeof TIME_FORMATS)[number]
export type WeekNumberingSystem = (typeof WEEK_NUMBERING_SYSTEMS)[number]
export interface CompanyBranding {
  primaryColor: string
  accentColor: string
  sidebarColor: string
  logoUrl: string | null
}

export const userPreferencesSchema = z
  .object({
    locale: z.enum(['nl', 'en']),
    theme: z.enum(UI_THEMES),
    useCompanyTheme: z.boolean().default(true),
    clockMode: z.enum(CLOCK_MODES).default('ANALOG'),
    analogClockStyle: z.enum(ANALOG_CLOCK_STYLES).default('LIQUID'),
    dateFormat: z.enum(DATE_FORMATS).default('DMY'),
    timeFormat: z.enum(TIME_FORMATS).default('24H'),
    weekNumberingSystem: z.enum(WEEK_NUMBERING_SYSTEMS).default('JANUARY_FIRST'),
  })
  .strict()

export type UserPreferences = z.infer<typeof userPreferencesSchema> & { companyBranding: CompanyBranding | null }

export const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'nl',
  theme: 'liquid-navy',
  useCompanyTheme: true,
  clockMode: 'ANALOG',
  analogClockStyle: 'LIQUID',
  dateFormat: 'DMY',
  timeFormat: '24H',
  weekNumberingSystem: 'JANUARY_FIRST',
  companyBranding: null,
}

export function parseUserPreferences(value: unknown): UserPreferences {
  const result = userPreferencesSchema.safeParse(value)
  return result.success ? { ...result.data, companyBranding: null } : DEFAULT_PREFERENCES
}

export function resolveUserPreferences(
  databaseValue: unknown,
  cookieValue: unknown,
): UserPreferences {
  const databaseResult = userPreferencesSchema.safeParse(databaseValue)
  if (databaseResult.success) return { ...databaseResult.data, companyBranding: null }

  const cookieRecord = typeof cookieValue === 'object' && cookieValue !== null
    ? cookieValue as Readonly<Record<string, unknown>>
    : {}
  const localeResult = userPreferencesSchema.shape.locale.safeParse(cookieRecord.locale)
  const themeResult = userPreferencesSchema.shape.theme.safeParse(cookieRecord.theme)

  return {
    locale: localeResult.success ? localeResult.data : DEFAULT_PREFERENCES.locale,
    theme: themeResult.success ? themeResult.data : DEFAULT_PREFERENCES.theme,
    useCompanyTheme: DEFAULT_PREFERENCES.useCompanyTheme,
    clockMode: DEFAULT_PREFERENCES.clockMode,
    analogClockStyle: DEFAULT_PREFERENCES.analogClockStyle,
    dateFormat: DEFAULT_PREFERENCES.dateFormat,
    timeFormat: DEFAULT_PREFERENCES.timeFormat,
    weekNumberingSystem: DEFAULT_PREFERENCES.weekNumberingSystem,
    companyBranding: null,
  }
}
