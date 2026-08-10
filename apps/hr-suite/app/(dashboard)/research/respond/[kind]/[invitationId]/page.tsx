import Link from 'next/link'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { ResearchResponseForm } from '@/components/research/research-response-form'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import type { ResearchKind } from '@/lib/research/admin-service'
import { ResearchError } from '@/lib/research/errors'
import { getResearchResponseForm } from '@/lib/research/respondent-service'

export default async function ResearchResponsePage({ params }: { params: Promise<{ kind: string; invitationId: string }> }) {
  const { kind, invitationId } = await params
  if (kind !== 'survey' && kind !== 'enps') notFound()
  const researchKind: ResearchKind = kind
  let form
  try {
    form = await getResearchResponseForm(researchKind, invitationId)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof ResearchError && error.status === 404) notFound()
    throw error
  }
  const [t, locale] = await Promise.all([getTranslator('research'), getLocale()])
  const now = Date.now()
  const available = form.status === 'ACTIVE' && Date.parse(form.startsAt) <= now && Date.parse(form.endsAt) >= now && !form.submitted
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  return <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80" href="/research"><ArrowLeft aria-hidden="true" size={16} />{t('response.back')}</Link>
    <header className="mb-8 mt-6">
      <p className="eyebrow">{form.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{form.title}</h1>
      {form.kind === 'survey' && form.description ? <p className="mt-3 text-base leading-7 text-muted-foreground">{form.description}</p> : null}
      <p className="mt-3 text-sm font-medium text-muted-foreground">{dateFormatter.format(new Date(form.startsAt))} – {dateFormatter.format(new Date(form.endsAt))}</p>
    </header>
    {available ? <ResearchResponseForm form={form} labels={{ privacyAnonymous: t('response.privacyAnonymous'), privacyNamed: t('response.privacyNamed'), required: t('response.required'), optional: t('response.optional'), select: t('response.select'), selectMultiple: t('response.selectMultiple'), yes: t('response.yes'), no: t('response.no'), scaleLow: t('response.scaleLow'), scaleHigh: t('response.scaleHigh'), submit: t('response.submit'), submitting: t('response.submitting'), error: t('response.error'), completedTitle: t('response.completedTitle'), completedDescription: t('response.completedDescription') }} /> : <section className="rounded-3xl border border-dashed bg-surface p-8 text-center"><CircleAlert aria-hidden="true" className="mx-auto text-primary" size={34} /><h2 className="mt-5 text-xl font-semibold">{t('response.unavailableTitle')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('response.unavailableDescription')}</p></section>}
  </main>
}
