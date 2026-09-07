import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { DistributionHistory } from '@/components/document-studio/distribution-history'
import { DistributionWorkbench } from '@/components/document-studio/distribution-workbench'
import { Button } from '@/components/ui/button'
import { AuthorizationError } from '@/lib/auth/permissions'
import { listDistributionHistory, listDistributionOptions } from '@/lib/document-generation/batch-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentDistributionPage() {
  const t = await getTranslator('documentStudio')
  let options: Awaited<ReturnType<typeof listDistributionOptions>>
  let history: Awaited<ReturnType<typeof listDistributionHistory>>
  try {
    ;[options, history] = await Promise.all([listDistributionOptions(), listDistributionHistory()])
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide">
    <PageHeader description={t('distribution.subtitle')} title={t('distribution.title')} />
    <div className="flex flex-wrap gap-3"><Link href="/document-studio/generate"><Button type="button" variant="secondary">{t('generation.title')}</Button></Link><Link href="/document-studio/signing"><Button type="button" variant="secondary">{t('signing.overviewTitle')}</Button></Link></div>
    <DistributionWorkbench labels={{
      template: t('distribution.template'), employees: t('distribution.employees'), searchEmployees: t('distribution.searchEmployees'), selected: t('distribution.selected'), selectionLimit: t('distribution.selectionLimit'), selectVisible: t('distribution.selectVisible'), clearSelection: t('distribution.clearSelection'), choose: t('generation.choose'), freeInputs: t('generation.freeInputs'), inputHint: t('generation.inputHint'), temporalInputs: t('generation.temporalInputs'), temporalHint: t('generation.temporalHint'), create: t('distribution.create'), submitted: t('distribution.submitted'), failed: t('generation.failed'),
    }} options={options} />
    <DistributionHistory items={history} labels={{ title: t('distribution.history'), status: t('generation.status'), requested: t('distribution.requested'), final: t('distribution.final'), failed: t('distribution.failed'), created: t('distribution.created'), open: t('distribution.open'), empty: t('distribution.empty') }} />
  </PageShell>
}
