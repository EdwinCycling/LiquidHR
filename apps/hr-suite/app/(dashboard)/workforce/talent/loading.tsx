import { getTranslator } from '@/lib/i18n/server'
import { Surface } from '@/components/ui/surface'

export default async function Loading() {
  const t = await getTranslator('talent')
  return <section aria-busy="true" className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><Surface className="p-6"><div className="animate-pulse space-y-4"><div className="h-5 w-48 rounded bg-muted" /><div className="h-4 w-96 max-w-full rounded bg-muted" /><div className="h-24 rounded-[var(--radius-surface)] bg-muted" /><p className="text-sm text-muted-foreground">{t('overview.pageLoading')}</p></div></Surface></section>
}
