import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { WvpDossier } from '@/components/absence/wvp-dossier'
import { wvpLabelKeys } from '@/components/absence/wvp-labels'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'
import { postgresUuidSchema } from '@/lib/absence/wvp/domain'
import { getProcessInstanceProjection, ProcessRuntimeError } from '@/lib/process-automation/runtime-service'

export default async function AbsenceGuidanceDetail({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params
  if (!postgresUuidSchema.safeParse(caseId).success) notFound()
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
  let processStatus: string | null = null
  if (dossier?.processInstanceId) {
    try { processStatus = (await getProcessInstanceProjection(dossier.processInstanceId)).status }
    catch (error) {
      if (!(error instanceof ProcessRuntimeError) || error.code !== 'FORBIDDEN') throw error
    }
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  return <PageShell className="py-7">
    <Link href="/absence/guidance" className="text-sm text-primary underline">{t('wvp.back')}</Link>
    <PageHeader className="my-6" title={dossier?.name ?? t('wvp.title')} description={t('wvp.description')} />
    {unavailable ? <p role="status">{t('wvp.schemaRequired')}</p> : <WvpDossier dossier={dossier} today={today} locale={locale} processStatus={processStatus} labels={Object.fromEntries(wvpLabelKeys.map(key => [key, t(`wvp.${key}`)]))} />}
  </PageShell>
}
