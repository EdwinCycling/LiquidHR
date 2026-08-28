import { redirect } from 'next/navigation'
import { QuestionBankManager } from '@/components/research/question-bank-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listResearchSettingsData } from '@/lib/research/admin-service'

export default async function ResearchQuestionBankPage() {
  let data
  try { data = await listResearchSettingsData() } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const t = await getTranslator('research')
  return <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backHref="/settings/research" backLabel={t('questionBank.back')} eyebrow={t('eyebrow')} subtitle={t('questionBank.subtitle')} title={t('questionBank.title')} /><QuestionBankManager categories={data.categories} labels={{ categories: t('questionBank.categories'), questions: t('questionBank.questions'), newCategory: t('questionBank.newCategory'), newQuestion: t('questionBank.newQuestion'), editCategory: t('questionBank.editCategory'), editQuestion: t('questionBank.editQuestion'), categoryName: t('questionBank.categoryName'), category: t('questionBank.category'), questionText: t('questionBank.questionText'), questionType: t('questionBank.questionType'), system: t('questionBank.system'), custom: t('questionBank.custom'), search: t('questionBank.search'), allCategories: t('questionBank.allCategories'), save: t('questionBank.save'), saving: t('questionBank.saving'), cancel: t('questionBank.cancel'), edit: t('questionBank.edit'), delete: t('questionBank.delete'), confirmDelete: t('questionBank.confirmDelete'), saved: t('questionBank.saved'), failed: t('questionBank.failed'), empty: t('questionBank.empty'), discardTitle: t('questionBank.discardTitle'), discardDescription: t('questionBank.discardDescription'), discardConfirm: t('questionBank.discardConfirm'), keepEditing: t('questionBank.keepEditing'), typeLabels: { SCALE_10: t('builder.scale10'), LIKERT_5: t('builder.likert5'), LIKERT_4: t('builder.likert4'), OPEN_TEXT: t('builder.typeTextMulti'), YES_NO: `${t('response.yes')} / ${t('response.no')}` } }} questions={data.questionBank} /></main>
}
