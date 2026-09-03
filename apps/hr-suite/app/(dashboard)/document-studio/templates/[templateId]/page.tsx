import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { getTemplateDetail } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'
import { CreateDraftButton } from '@/components/document-studio/create-draft-button'
import { ArchiveTemplateButton } from '@/components/document-studio/archive-template-button'

type PageProps = { params: Promise<{ templateId: string }> }

export default async function DocumentStudioTemplatePage({ params }: PageProps) {
  const { templateId } = await params
  const [t, detail] = await Promise.all([getTranslator('documentStudio'), getTemplateDetail(templateId)])
  if (!detail) notFound()
  const labels = createDocumentStudioLabels(t)
  const draft = detail.versions.find((version) => version.status === 'DRAFT')
  const active = detail.versions.find((version) => version.status === 'ACTIVE')
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><PageHeader description={detail.description ?? undefined} title={detail.name} actions={<div className="flex flex-wrap gap-2">{draft ? <Link className={buttonClasses({ variant: 'secondary' })} href={`/document-studio/templates/${detail.id}/edit?version=${draft.id}`}>{labels.editor.title}</Link> : active ? <><CreateDraftButton labels={{ create: t('editor.save'), failed: t('editor.failed') }} templateId={detail.id} /><ArchiveTemplateButton labels={{ archive: labels.editor.archive, confirm: labels.editor.archiveConfirm, failed: labels.editor.failed }} templateId={detail.id} /></> : null}</div>} /><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/document-studio">{labels.editor.back}</Link><Surface className="overflow-x-auto"><table className="min-w-[42rem] w-full text-left text-sm"><thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{t('library.status')}</th><th className="px-4 py-3">{t('library.version')}</th><th className="px-4 py-3">{t('editor.revision')}</th><th className="px-4 py-3">{t('library.updated')}</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-border">{detail.versions.map((version) => <tr key={version.id}><td className="px-4 py-3">{version.status === 'DRAFT' ? t('library.draft') : version.status === 'ACTIVE' ? t('library.active') : t('library.archived')}</td><td className="px-4 py-3">{version.version_number ?? '—'}</td><td className="px-4 py-3">{version.revision}</td><td className="px-4 py-3">{new Date(version.updated_at).toLocaleDateString()}</td><td className="px-4 py-3 text-right">{version.status === 'DRAFT' ? <Link className="text-primary underline-offset-4 hover:underline" href={`/document-studio/templates/${detail.id}/edit?version=${version.id}`}>{labels.library.open}</Link> : null}</td></tr>)}</tbody></table></Surface></PageShell>
}
