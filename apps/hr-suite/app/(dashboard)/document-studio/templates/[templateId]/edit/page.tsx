import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { TemplateWorkbench } from '@/components/document-studio/template-workbench'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { getEditorData, getTemplateDetail } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

type PageProps = { params: Promise<{ templateId: string }>; searchParams: Promise<{ version?: string }> }

export default async function DocumentStudioTemplateEditPage({ params, searchParams }: PageProps) {
  const [{ templateId }, query] = await Promise.all([params, searchParams])
  const t = await getTranslator('documentStudio')
  const data = query.version
    ? await getEditorData(query.version)
    : await getTemplateDetail(templateId).then((detail) => {
      const draft = detail?.versions.find((version) => version.status === 'DRAFT')
      return draft ? getEditorData(draft.id) : null
    })
  if (!data || data.template.id !== templateId || data.version.status !== 'DRAFT') notFound()
  const labels = createDocumentStudioLabels(t)
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><PageHeader title={labels.editor.title} /><TemplateWorkbench data={data} labels={labels.editor} /></PageShell>
}
