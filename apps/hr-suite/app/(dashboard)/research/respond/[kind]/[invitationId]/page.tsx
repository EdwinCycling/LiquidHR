import Link from 'next/link'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
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
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  return <PageShell className="py-8 sm:py-10" width="reading">
    <PageHeader actions={<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/research"><ArrowLeft aria-hidden="true" size={16} />{t('response.back')}</Link>} className="mb-8" description={<><p className="eyebrow">{form.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</p>{form.kind === 'survey' && form.description ? <p className="mt-3 text-base leading-7 text-muted-foreground">{form.description}</p> : null}<p className="mt-3 text-sm font-medium text-muted-foreground">{dateFormatter.format(new Date(form.startsAt))} – {dateFormatter.format(new Date(form.endsAt))}</p></>} title={form.title} />
    {form.available ? <ResearchResponseForm form={form} labels={{ privacyAnonymous: t('response.privacyAnonymous'), privacyNamed: t('response.privacyNamed'), required: t('response.required'), optional: t('response.optional'), select: t('response.select'), selectMultiple: t('response.selectMultiple'), yes: t('response.yes'), no: t('response.no'), scaleLow: t('response.scaleLow'), scaleHigh: t('response.scaleHigh'), submit: t('response.submit'), submitting: t('response.submitting'), error: t('response.error'), completedTitle: t('response.completedTitle'), completedDescription: t('response.completedDescription') }} /> : <EmptyState icon={<CircleAlert />} title={t('response.unavailableTitle')} description={t('response.unavailableDescription')} />}
  </PageShell>
}
