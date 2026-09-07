import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { DistributionItems } from '@/components/document-studio/distribution-items'
import { Button } from '@/components/ui/button'
import { AuthorizationError } from '@/lib/auth/permissions'
import { listDistributionItems } from '@/lib/document-generation/batch-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentDistributionDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const t = await getTranslator('documentStudio')
  let items: Awaited<ReturnType<typeof listDistributionItems>>
  try {
    items = await listDistributionItems((await params).batchId)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide">
    <PageHeader description={t('distribution.detailSubtitle')} title={t('distribution.detailTitle')} />
    <Link href="/document-studio/distributions"><Button type="button" variant="secondary">{t('editor.back')}</Button></Link>
    <DistributionItems items={items} labels={{ title: t('distribution.recipients'), employee: t('distribution.employee'), status: t('generation.status'), error: t('distribution.error'), prepareSigning: t('signing.prepare'), prepared: t('signing.prepared'), failed: t('generation.failed') }} />
  </PageShell>
}
