import Link from 'next/link'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { TemplateCreateForm } from '@/components/document-studio/template-create-form'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { listProfiles, listTypes } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function NewDocumentStudioTemplatePage() {
  const t = await getTranslator('documentStudio')
  const labels = createDocumentStudioLabels(t)
  const [types, profiles] = await Promise.all([listTypes(), listProfiles()])
  return <PageShell className="space-y-6 py-7 lg:py-10" width="standard"><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/document-studio">{labels.editor.back}</Link><PageHeader description={t('create.subtitle')} title={t('create.title')} /><TemplateCreateForm labels={labels.create} profiles={profiles} types={types} /></PageShell>
}
