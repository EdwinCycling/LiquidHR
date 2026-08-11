import { redirect } from 'next/navigation'
import { SurveyBuilder } from '@/components/research/survey-builder'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getSurveyDraft, listResearchSettingsData } from '@/lib/research/admin-service'
import { ResearchError } from '@/lib/research/errors'

export default async function NewSurveyPage({ searchParams }: { searchParams: Promise<{ campaignId?: string }> }) {
  let data
  try { data = await listResearchSettingsData() } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  if (!data.modules.surveys) redirect('/settings/research')
  const campaignId = (await searchParams).campaignId
  let draft
  if (campaignId) {
    try { draft = await getSurveyDraft(campaignId) } catch (error) {
      if (error instanceof AuthorizationError || (error instanceof ResearchError && error.code === 'RESEARCH_CAMPAIGN_NOT_DRAFT')) redirect('/settings/research')
      throw error
    }
  }
  const t = await getTranslator('research')
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backHref="/settings/research" backLabel={t('builder.back')} eyebrow={t('eyebrow')} subtitle={draft ? t('builder.surveyEditSubtitle') : t('builder.surveySubtitle')} title={draft ? t('builder.surveyEditTitle') : t('builder.surveyTitle')} /><SurveyBuilder draft={draft} labels={{ campaign: t('builder.campaign'), title: t('builder.title'), description: t('builder.description'), startsAt: t('builder.startsAt'), endsAt: t('builder.endsAt'), anonymous: t('builder.anonymous'), target: t('builder.target'), targetMode: t('builder.targetMode'), targetAll: t('builder.targetAll'), targetDepartments: t('builder.targetDepartments'), targetLocations: t('builder.targetLocations'), targetEntities: t('builder.targetEntities'), targetEmployees: t('builder.targetEmployees'), targetSearch: t('builder.targetSearch'), targetEmpty: t('builder.targetEmpty'), selected: t('builder.selected'), questions: t('builder.questions'), addQuestion: t('builder.addQuestion'), question: t('builder.question'), questionText: t('builder.questionText'), questionType: t('builder.questionType'), required: t('builder.required'), remove: t('builder.remove'), moveUp: t('builder.moveUp'), moveDown: t('builder.moveDown'), options: t('builder.options'), optionPlaceholder: t('builder.optionPlaceholder'), matrixRows: t('builder.matrixRows'), matrixPlaceholder: t('builder.matrixPlaceholder'), typeTextSingle: t('builder.typeTextSingle'), typeTextMulti: t('builder.typeTextMulti'), typeSingleChoice: t('builder.typeSingleChoice'), typeMultiChoice: t('builder.typeMultiChoice'), typeNumber: t('builder.typeNumber'), typeDate: t('builder.typeDate'), typeDatetime: t('builder.typeDatetime'), typeMatrix: t('builder.typeMatrix'), saveDraft: draft ? t('builder.saveChanges') : t('builder.saveDraft'), saving: t('builder.saving'), saveFailed: t('builder.saveFailed') }} targets={data.targets} /></main>
}
