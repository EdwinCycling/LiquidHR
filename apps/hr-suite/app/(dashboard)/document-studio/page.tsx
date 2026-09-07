import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { TemplateLibrary } from '@/components/document-studio/template-library'
import { Button } from '@/components/ui/button'
import { AuthorizationError } from '@/lib/auth/permissions'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { listTemplates } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentStudioPage() {
  const t = await getTranslator('documentStudio')
  const labels = createDocumentStudioLabels(t)
  let templates: Awaited<ReturnType<typeof listTemplates>>
  try {
    templates = await listTemplates()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide">
    <PageHeader description={t('subtitle')} title={t('title')} />
    <div className="flex flex-wrap gap-3"><Link href="/document-studio/generate"><Button type="button">{t('generation.title')}</Button></Link><Link href="/document-studio/distributions"><Button type="button" variant="secondary">{t('distribution.title')}</Button></Link><Link href="/document-studio/signing"><Button type="button" variant="secondary">{t('signing.overviewTitle')}</Button></Link></div>
    <TemplateLibrary labels={labels.library} templates={templates} />
  </PageShell>
}
