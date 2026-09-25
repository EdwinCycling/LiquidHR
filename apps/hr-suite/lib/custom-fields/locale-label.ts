import type { Locale } from '@/lib/i18n/config'

export function localizedCustomFieldLabel(labelNl: string, labelEn: string, locale: Locale): string {
  return locale === 'en' ? labelEn : labelNl
}
