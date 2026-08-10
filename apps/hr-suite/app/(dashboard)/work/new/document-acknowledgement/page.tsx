import Link from 'next/link'
import { DocumentAcknowledgementStartForm, type DocumentAcknowledgementStartLabels } from '@/components/process-automation/document-acknowledgement-start-form'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getDocumentAcknowledgementStartData, type DocumentAcknowledgementStartData } from '@/lib/process-automation/document-acknowledgement-service'
import { ProcessRecipeError } from '@/lib/process-automation/recipe-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentAcknowledgementStartPage() {
  const t = await getTranslator('processAutomation')
  let data: DocumentAcknowledgementStartData | null = null
  try { data = await getDocumentAcknowledgementStartData() } catch (error) {
    if (error instanceof AuthorizationError) {
      return <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-10"><section className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="eyebrow text-primary">P10</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('p10.startTitle')}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{t('denied')}</p><Link className="button-primary mt-6 inline-flex" href="/work">{t('p10.back')}</Link></section></main>
    }
    if (error instanceof ProcessRecipeError && error.code === 'PROCESS_RECIPE_NOT_ACTIVATED') {
      return <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-10"><section className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="eyebrow text-primary">P10</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('p10.startTitle')}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{t('p10.notActivated')}</p><Link className="button-primary mt-6 inline-flex" href="/settings/process-automation?tab=forms">{t('p10.activate')}</Link></section></main>
    }
    throw error
  }
  if (!data) throw new Error('DOCUMENT_ACKNOWLEDGEMENT_START_DATA_MISSING')
  const labels: DocumentAcknowledgementStartLabels = {
    title: t('p10.startTitle'), description: t('p10.startDescription'), employee: t('p10.employee'), document: t('p10.document'), choose: t('p10.choose'), required: t('p10.required'), start: t('p10.start'), starting: t('p10.starting'), failed: t('p10.failed'), back: t('p10.back'),
  }
  return <DocumentAcknowledgementStartForm data={data} labels={labels} />
}
