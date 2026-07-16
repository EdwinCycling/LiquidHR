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
export type ClockMode = (typeof CLOCK_MODES)[number]
export type AnalogClockStyle = (typeof ANALOG_CLOCK_STYLES)[number]

export const userPreferencesSchema = z
  .object({
    locale: z.enum(['nl', 'en']),
    theme: z.enum(UI_THEMES),
    clockMode: z.enum(CLOCK_MODES).default('ANALOG'),
    analogClockStyle: z.enum(ANALOG_CLOCK_STYLES).default('LIQUID'),
  })
  .strict()

export type UserPreferences = z.infer<typeof userPreferencesSchema>

export const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'nl',
  theme: 'liquid-navy',
  clockMode: 'ANALOG',
  analogClockStyle: 'LIQUID',
}

export function parseUserPreferences(value: unknown): UserPreferences {
  const result = userPreferencesSchema.safeParse(value)
  return result.success ? result.data : DEFAULT_PREFERENCES
}

export function resolveUserPreferences(
  databaseValue: unknown,
  cookieValue: unknown,
): UserPreferences {
  const databaseResult = userPreferencesSchema.safeParse(databaseValue)
  if (databaseResult.success) return databaseResult.data

  const cookieRecord = typeof cookieValue === 'object' && cookieValue !== null
    ? cookieValue as Readonly<Record<string, unknown>>
    : {}
  const localeResult = userPreferencesSchema.shape.locale.safeParse(cookieRecord.locale)
  const themeResult = userPreferencesSchema.shape.theme.safeParse(cookieRecord.theme)

  return {
    locale: localeResult.success ? localeResult.data : DEFAULT_PREFERENCES.locale,
    theme: themeResult.success ? themeResult.data : DEFAULT_PREFERENCES.theme,
    clockMode: DEFAULT_PREFERENCES.clockMode,
    analogClockStyle: DEFAULT_PREFERENCES.analogClockStyle,
  }
}
