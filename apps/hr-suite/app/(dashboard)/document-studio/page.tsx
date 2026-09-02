import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { TemplateLibrary } from '@/components/document-studio/template-library'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { listTemplates } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentStudioPage() {
  const t = await getTranslator('documentStudio')
  const labels = createDocumentStudioLabels(t)
  const templates = await listTemplates()
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><PageHeader description={t('subtitle')} title={t('title')} /><TemplateLibrary labels={labels.library} templates={templates} /></PageShell>
}
