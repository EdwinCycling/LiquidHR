import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { GenerationWorkbench } from '@/components/document-studio/generation-workbench'
import { GenerationHistory } from '@/components/document-studio/generation-history'
import { listGenerationHistory, listGenerationOptions } from '@/lib/document-generation/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentGenerationPage() {
  const t = await getTranslator('documentStudio')
  const [options, history] = await Promise.all([listGenerationOptions(), listGenerationHistory()])
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide">
    <PageHeader description={t('generation.subtitle')} title={t('generation.title')} />
    <GenerationWorkbench labels={{
      template: t('generation.template'),
      employee: t('generation.employee'),
      choose: t('generation.choose'),
      freeInputs: t('generation.freeInputs'),
      temporalInputs: t('generation.temporalInputs'),
      inputHint: t('generation.inputHint'),
      temporalHint: t('generation.temporalHint'),
      createPreview: t('generation.createPreview'),
      preview: t('generation.preview'),
      finalize: t('generation.finalize'),
      final: t('generation.final'),
      download: t('generation.download'),
      dossier: t('generation.dossier'),
      dossierCreated: t('generation.dossierCreated'),
      dossierNotSaved: t('generation.dossierNotSaved'),
      failed: t('generation.failed'),
    }} options={options} />
    <GenerationHistory items={history} labels={{
      title: t('generation.history'),
      status: t('generation.status'),
      generatedAt: t('generation.generatedAt'),
      generatedBy: t('generation.generatedBy'),
      dossier: t('generation.dossier'),
      dossierCreated: t('generation.dossierCreated'),
      dossierPending: t('generation.dossierPending'),
      dossierNotSaved: t('generation.dossierNotSaved'),
      noHistory: t('generation.noHistory'),
      download: t('generation.download'),
    }} />
  </PageShell>
}
