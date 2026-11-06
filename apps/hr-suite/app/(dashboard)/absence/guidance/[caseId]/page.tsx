import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { WvpDossier } from '@/components/absence/wvp-dossier'
import { wvpLabelKeys } from '@/components/absence/wvp-labels'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listEmployeeDocumentLinkOptions, type EmployeeDocumentLinkOption } from '@/lib/documents/document-service'
import { listWvpCases, listWvpDocumentLinks, WvpError } from '@/lib/absence/wvp/service'
import { postgresUuidSchema } from '@/lib/absence/wvp/domain'

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
  let documentLinks: Awaited<ReturnType<typeof listWvpDocumentLinks>> = []
  let documentOptions: EmployeeDocumentLinkOption[] = []
  let linksUnavailable = false
  let documentReadUnavailable = false
  if (dossier?.processInstanceId) {
    try { documentLinks = await listWvpDocumentLinks(caseId) }
    catch (error) {
      if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') linksUnavailable = true
      else throw error
    }
    if (!linksUnavailable) {
      try { documentOptions = await listEmployeeDocumentLinkOptions(dossier.employeeId) }
      catch (error) {
        if (error instanceof AuthorizationError) documentReadUnavailable = true
        else throw error
      }
    }
  }
  const canManageDocumentLinks = Boolean(dossier?.processInstanceId && dossier.canManage && !dossier.closedAt && !linksUnavailable && !documentReadUnavailable)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  return <PageShell className="py-7">
    <Link href="/absence/guidance" className="text-sm text-primary underline">{t('wvp.back')}</Link>
    <PageHeader className="my-6" title={dossier?.name ?? t('wvp.title')} description={t('wvp.description')} />
    {unavailable ? <p role="status">{t('wvp.schemaRequired')}</p> : <WvpDossier dossier={dossier} documentLinks={documentLinks} documentOptions={documentOptions} canManageDocumentLinks={canManageDocumentLinks} linksUnavailable={linksUnavailable} documentReadUnavailable={documentReadUnavailable} today={today} locale={locale} labels={Object.fromEntries(wvpLabelKeys.map(key => [key, t(`wvp.${key}`)]))} />}
  </PageShell>
}
