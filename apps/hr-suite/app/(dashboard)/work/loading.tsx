import { getTranslator } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'

export default async function WorkLoading() {
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  return <section aria-busy="true" className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-10"><div className="rounded-2xl border border-border bg-surface p-8 text-sm text-muted-foreground">{t('loading')}</div></section>
}
