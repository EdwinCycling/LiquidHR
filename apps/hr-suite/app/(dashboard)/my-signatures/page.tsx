import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { MySigningRequests } from '@/components/document-studio/my-signing-requests'
import { listMySigningRequests } from '@/lib/document-generation/signing-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function MySignaturesPage() {
  const t = await getTranslator('documentStudio')
  const requests = await listMySigningRequests()
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><PageHeader description={t('signing.mySubtitle')} title={t('signing.myTitle')} /><MySigningRequests items={requests} labels={{ title: t('signing.requests'), status: t('generation.status'), prepared: t('signing.preparedAt'), sign: t('signing.sign'), signed: t('signing.signed'), viewDocument: t('signing.viewDocument'), empty: t('signing.empty'), failed: t('generation.failed') }} /></PageShell>
}
