import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getTranslator } from '@/lib/i18n/server'
import { PublicApplicationForm, type PublicApplicationFieldMode } from '@/components/recruitment/public-application-form'
import { getPublicVacancy, getPublicVacancyState } from '@/lib/recruitment/public-repository'

export default async function PublicVacancyBoundaryPage({ params }: { params: Promise<{ publicId: string; slug: string }> }) {
  const { publicId, slug } = await params
  const parsedId = z.guid().safeParse(publicId)
  if (!parsedId.success) notFound()
  const vacancy = await getPublicVacancy(parsedId.data, slug)
  const t = await getTranslator('recruitment')
  if (!vacancy) {
    const state = await getPublicVacancyState(parsedId.data, slug)
    if (!state) notFound()
    return <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10"><article className="w-full rounded-xl border bg-surface p-8 text-center sm:p-12"><p className="eyebrow">{t('public.eyebrow')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{state.title}</h1><p className="mt-4 text-muted-foreground">{t('public.closed')}</p></article></main>
  }
  const content = vacancy.content
  const companyName = typeof content.companyName === 'string' ? content.companyName : 'LiquidHR'
  const sections = Array.isArray(content.sections) ? content.sections.filter((section): section is { title: string; content: string; isVisible?: boolean } => typeof section === 'object' && section !== null && 'title' in section && typeof section.title === 'string' && 'content' in section && typeof section.content === 'string' && (!('isVisible' in section) || typeof section.isVisible === 'boolean')) : []
  const formConfigValue = typeof content.formConfig === 'object' && content.formConfig !== null ? content.formConfig as Record<string, unknown> : {}
  const fieldMode = (value: unknown): PublicApplicationFieldMode => value === 'HIDDEN' || value === 'REQUIRED' ? value : 'OPTIONAL'
  const formConfig = { phone: fieldMode(formConfigValue.phone), cv: fieldMode(formConfigValue.cv), motivation: fieldMode(formConfigValue.motivation) }
  const jobPosting = JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', title: vacancy.title, hiringOrganization: { '@type': 'Organization', name: companyName }, jobLocation: vacancy.location ? { '@type': 'Place', address: vacancy.location } : undefined, description: sections.map((section) => section.content).join('\n\n') }).replace(/</g, '\\u003c')
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <script dangerouslySetInnerHTML={{ __html: jobPosting }} type="application/ld+json" />
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between border-b pb-5"><div><p className="text-sm font-semibold tracking-tight">{companyName}</p><p className="mt-1 text-xs text-muted-foreground">{t('public.brandLine')}</p></div><span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border bg-surface text-xs font-semibold">LH</span></header>
        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-16">
          <div><p className="eyebrow">{t('public.eyebrow')}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{vacancy.title}</h1><div className="mt-5 flex flex-wrap gap-2 text-sm text-muted-foreground">{vacancy.location ? <span className="rounded-full border bg-surface px-3 py-1.5">{vacancy.location}</span> : null}<span className="rounded-full border bg-surface px-3 py-1.5">{t('public.hybrid')}</span></div></div>
          <aside className="h-fit rounded-xl border bg-surface p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('public.quickFacts')}</p><p className="mt-4 text-sm leading-6 text-muted-foreground">{t('public.quickFactsDescription')}</p><a className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href="#apply">{t('public.apply')}</a></aside>
        </section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="space-y-8">{sections.filter((section) => section.isVisible !== false).map((section) => <section key={section.title}><h2 className="text-xl font-semibold">{section.title}</h2><div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{section.content || t('public.emptySection')}</div></section>)}</article>
          <aside className="lg:order-last"><div className="rounded-xl border bg-muted/25 p-5 text-sm text-muted-foreground"><p className="font-semibold text-foreground">{t('public.noAccount')}</p><p className="mt-2 leading-6">{t('public.noAccountDescription')}</p></div></aside>
        </div>
        <section className="mt-14 scroll-mt-8 rounded-xl border bg-surface p-6 sm:p-8" id="apply"><p className="eyebrow">{t('public.applyEyebrow')}</p><h2 className="mt-2 text-2xl font-semibold">{t('public.applyTitle')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('public.applyDescription')}</p><div className="mt-8"><PublicApplicationForm config={formConfig} publicId={parsedId.data} slug={slug} labels={{ title: t('public.applyTitle'), firstName: t('public.firstName'), lastName: t('public.lastName'), email: t('public.email'), phone: t('public.phone'), motivation: t('public.motivation'), cv: t('public.cv'), privacy: t('public.privacy'), privacyLink: t('public.privacyLink'), submit: t('public.submit'), submitting: t('public.submitting'), securityBlocked: t('public.securityBlocked'), confirmed: t('public.confirmed'), confirmedDescription: t('public.confirmedDescription'), error: t('public.error') }} /></div></section>
        <footer className="border-t py-8 text-xs text-muted-foreground">{t('public.footer')}</footer>
      </div>
    </main>
  )
}
