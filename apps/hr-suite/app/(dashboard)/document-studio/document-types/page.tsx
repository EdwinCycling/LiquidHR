import Link from 'next/link'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { DocumentTypeManager } from '@/components/document-studio/document-type-manager'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { listTypes } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentStudioTypesPage() {
  const t = await getTranslator('documentStudio'); const labels = createDocumentStudioLabels(t); const types = await listTypes()
  return <PageShell className="space-y-6 py-7 lg:py-10" width="standard"><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/document-studio">{labels.editor.back}</Link><PageHeader description={labels.types.subtitle} title={labels.types.title} /><DocumentTypeManager initial={types} labels={labels.types} /></PageShell>
}
