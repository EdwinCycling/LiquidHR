import { getTranslator } from '@/lib/i18n/server'

export default async function ProcessAutomationInsightsLoading() {
  const t = await getTranslator('insights')
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <p className="sr-only">{t('processAutomationLoading')}</p>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-9 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-24 animate-pulse rounded-[var(--radius-surface)] border border-border bg-surface" key={index} />)}</div>
      <div className="mt-8 h-72 animate-pulse rounded-[var(--radius-surface)] border border-border bg-surface" />
    </main>
  )
}
