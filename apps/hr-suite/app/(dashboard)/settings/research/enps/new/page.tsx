import { redirect } from 'next/navigation'
import { EnpsBuilder } from '@/components/research/enps-builder'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listResearchSettingsData } from '@/lib/research/admin-service'

export default async function NewEnpsPage() {
  let data
  try { data = await listResearchSettingsData() } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  if (!data.modules.enps) redirect('/settings/research')
  const t = await getTranslator('research')
  return <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backHref="/settings/research" backLabel={t('builder.back')} eyebrow={t('eyebrow')} subtitle={t('builder.enpsSubtitle')} title={t('builder.enpsTitle')} /><EnpsBuilder bank={data.questionBank} categories={data.categories} labels={{ campaign: t('builder.campaign'), title: t('builder.title'), startsAt: t('builder.startsAt'), endsAt: t('builder.endsAt'), target: t('builder.target'), targetMode: t('builder.targetMode'), targetAll: t('builder.targetAll'), targetDepartments: t('builder.targetDepartments'), targetLocations: t('builder.targetLocations'), targetEntities: t('builder.targetEntities'), targetEmployees: t('builder.targetEmployees'), targetSearch: t('builder.targetSearch'), targetEmpty: t('builder.targetEmpty'), selected: t('builder.selected'), questions: t('builder.questions'), scale: t('builder.scale'), scale10: t('builder.scale10'), likert5: t('builder.likert5'), likert4: t('builder.likert4'), openText: t('builder.typeTextMulti'), yesNo: `${t('response.yes')} / ${t('response.no')}`, reminderInterval: t('builder.reminderInterval'), mandatoryEnps: t('builder.mandatoryEnps'), mandatoryDescription: t('builder.mandatoryDescription'), questionBank: t('builder.questionBank'), questionBankSearch: t('builder.questionBankSearch'), categoryAll: t('builder.categoryAll'), addBankQuestion: t('builder.addBankQuestion'), added: t('builder.added'), selectedQuestions: t('builder.selectedQuestions'), remove: t('builder.remove'), moveUp: t('builder.moveUp'), moveDown: t('builder.moveDown'), enabled: t('builder.enabled'), disabled: t('builder.disabled'), customQuestion: t('builder.customQuestion'), customQuestionPlaceholder: t('builder.customQuestionPlaceholder'), addCustomQuestion: t('builder.addCustomQuestion'), addingCustomQuestion: t('builder.addingCustomQuestion'), saveDraft: t('builder.saveDraft'), saving: t('builder.saving'), saveFailed: t('builder.saveFailed') }} targets={data.targets} /></main>
}
