import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { WvpDossier, wvpLabelKeys } from '@/components/absence/wvp-dossier'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'

export default async function AbsenceGuidanceDetail({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params
  if (!z.string().uuid().safeParse(caseId).success) notFound()
  const [locale, t] = await Promise.all([getLocale(), getTranslator('employees')])
  let dossiers: Awaited<ReturnType<typeof listWvpCases>> = []
  let unavailable = false
  try { dossiers = await listWvpCases(caseId) }
  catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') unavailable = true
    else throw error
  }
  const dossier = dossiers[0]
  if (!unavailable && !dossier) notFound()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  return <PageShell className="py-7">
    <Link href="/absence/guidance" className="text-sm text-primary underline">{t('wvp.back')}</Link>
    <PageHeader className="my-6" title={dossier?.name ?? t('wvp.title')} description={t('wvp.description')} />
    {unavailable ? <p role="status">{t('wvp.schemaRequired')}</p> : <WvpDossier dossier={dossier} today={today} locale={locale} labels={Object.fromEntries(wvpLabelKeys.map(key => [key, t(`wvp.${key}`)]))} />}
  </PageShell>
}
