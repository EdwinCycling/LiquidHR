import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'

export default async function AbsenceGuidancePage() {
  const t = await getTranslator('employees')
  let cases: Awaited<ReturnType<typeof listWvpCases>> = []
  let unavailable = false
  try { cases = await listWvpCases() }
  catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') unavailable = true
    else throw error
  }
  return <PageShell className="py-7">
    <PageHeader title={t('wvp.title')} description={t('wvp.description')} />
    <Link href="/work" className="my-4 inline-block text-sm text-primary underline">{t('wvp.work')}</Link>
    {unavailable ? <p role="status">{t('wvp.schemaRequired')}</p> : <>
      <p className="mb-4 text-sm text-muted-foreground">{t('wvp.privacy')}</p>
      <ul className="divide-y divide-border-subtle border-y border-border-subtle">{cases.map(dossier => <li key={dossier.id}><Link className="flex flex-wrap justify-between gap-2 py-4 focus-visible:outline-2 focus-visible:outline-focus" href={`/absence/guidance/${dossier.id}`}><span className="min-w-0 break-words font-semibold">{dossier.name}</span><span className="text-sm">{t(`wvp.${dossier.closedAt ? 'CLOSED' : dossier.status}`)} · {dossier.firstAbsenceOn}</span></Link></li>)}</ul>
      {!cases.length && <p className="mt-4">{t('wvp.empty')}</p>}
      {cases.length === 250 && <p className="mt-4 text-sm">{t('wvp.truncated')}</p>}
    </>}
  </PageShell>
}
