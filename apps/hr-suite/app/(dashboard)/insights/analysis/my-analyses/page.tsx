import { MyAnalyses } from '@/components/insights/my-analyses'
import { PageShell } from '@/components/layout/page-shell'
import { getTranslator } from '@/lib/i18n/server'
import { requireAnalysisPageAccess } from '@/lib/insights/analysis-page-access'
import { listMySavedAnalyses } from '@/lib/insights/saved-analysis-service'
import { SavedAnalysisError } from '@/lib/insights/saved-analysis-errors'
import type { SavedAnalysisListItem } from '@/lib/insights/saved-analysis-definition'

export default async function MyAnalysesPage() {
  await requireAnalysisPageAccess()
  const t = await getTranslator('insights')
  let initialItems: readonly SavedAnalysisListItem[] = []
  let loadError = false
  try {
    initialItems = await listMySavedAnalyses()
  } catch (error) {
    if (error instanceof SavedAnalysisError) loadError = true
    else throw error
  }

  return (
    <PageShell className="py-8 lg:py-10">
      <MyAnalyses initialItems={initialItems} labels={{
        backToExplore: t('analysisMyAnalysesBackToExplore'),
        cancel: t('analysisMyAnalysesCancel'),
        delete: t('analysisMyAnalysesDelete'),
        deleteConfirm: t('analysisMyAnalysesDeleteConfirm'),
        deleteDescription: t('analysisMyAnalysesDeleteDescription'),
        deleteTitle: t('analysisMyAnalysesDeleteTitle'),
        deleted: t('analysisMyAnalysesDeleted'),
        empty: t('analysisMyAnalysesEmpty'),
        emptyDescription: t('analysisMyAnalysesEmptyDescription'),
        eyebrow: t('analysisMyAnalysesEyebrow'),
        intro: t('analysisMyAnalysesIntro'),
        loadFailed: t('analysisMyAnalysesLoadFailed'),
        open: t('analysisMyAnalysesOpen'),
        rename: t('analysisMyAnalysesRename'),
        renameDescription: t('analysisMyAnalysesRenameDescription'),
        renameTitle: t('analysisMyAnalysesRenameTitle'),
        save: t('analysisMyAnalysesSave'),
        saving: t('analysisMyAnalysesSaving'),
        title: t('analysisMyAnalysesPageTitle'),
        updated: t('analysisMyAnalysesUpdated'),
      }} loadError={loadError} />
    </PageShell>
  )
}
