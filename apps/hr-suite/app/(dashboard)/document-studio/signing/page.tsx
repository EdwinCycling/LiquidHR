import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { AuthorizationError } from '@/lib/auth/permissions'
import { listSigningRequests } from '@/lib/document-generation/signing-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentSigningPage() {
  const t = await getTranslator('documentStudio')
  let requests: Awaited<ReturnType<typeof listSigningRequests>>
  try {
    requests = await listSigningRequests()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide">
    <PageHeader description={t('signing.overviewSubtitle')} title={t('signing.overviewTitle')} />
    <div><Link href="/document-studio/distributions"><Button type="button" variant="secondary">{t('distribution.title')}</Button></Link></div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">{t('signing.requests')}</h2>{requests.length === 0 ? <p className="text-sm text-muted-foreground">{t('signing.empty')}</p> : <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface"><tr><th className="px-4 py-3">{t('distribution.employee')}</th><th className="px-4 py-3">{t('generation.status')}</th><th className="px-4 py-3">{t('signing.provider')}</th><th className="px-4 py-3">{t('distribution.created')}</th></tr></thead><tbody>{requests.map((request) => <tr className="border-b border-border last:border-0" key={String(request.id)}><td className="px-4 py-3">{String(request.employeeId ?? '')}</td><td className="px-4 py-3">{String(request.status ?? '')}</td><td className="px-4 py-3">{String(request.providerCode ?? '')}</td><td className="px-4 py-3">{String(request.createdAt ?? '')}</td></tr>)}</tbody></table></div>}</section>
  </PageShell>
}
