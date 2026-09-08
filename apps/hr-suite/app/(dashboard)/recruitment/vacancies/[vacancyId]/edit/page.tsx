import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'
import { VacancyForm } from '@/components/recruitment/vacancy-form'
import { isAiImproveAvailable } from '@/lib/ai/supabase-governance'

export default async function EditRecruitmentVacancyPage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  try { await requireTenantModule('RECRUITMENT'); await requirePermission('recruitment-vacancy:write') } catch (error) { if (error instanceof ModuleError && error.status === 404) notFound(); if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const { vacancyId } = await params
  const [{ context, supabase }, t, locale] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment'), getLocale()])
  const vacancy = await getRecruitmentVacancy(context, vacancyId, supabase)
  if (!vacancy) notFound()
  const aiLabels = { aiTitle: t('vacancy.aiTitle'), aiDescription: t('vacancy.aiDescription'), aiTarget: t('vacancy.aiTarget'), aiInstruction: t('vacancy.aiInstruction'), aiInstructionPlaceholder: t('vacancy.aiInstructionPlaceholder'), aiGenerate: t('vacancy.aiGenerate'), aiWorking: t('vacancy.aiWorking'), aiReviewTitle: t('vacancy.aiReviewTitle'), aiApply: t('vacancy.aiApply'), aiCancel: t('vacancy.aiCancel'), aiCopy: t('vacancy.aiCopy'), aiCopied: t('vacancy.aiCopied'), aiRetry: t('vacancy.aiRetry'), aiFailed: t('vacancy.aiFailed'), aiTargets: { ALL: t('vacancy.aiTargetAll'), INTRODUCTION: t('vacancy.aiTargetIntroduction'), ROLE: t('vacancy.aiTargetRole'), PROFILE: t('vacancy.aiTargetProfile'), OFFER: t('vacancy.aiTargetOffer'), PROCESS: t('vacancy.aiTargetProcess'), CONTACT: t('vacancy.aiTargetContact') } }
  return <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('vacancy.editTitle')}</h1><section className="mt-8 rounded-xl border bg-surface p-5 sm:p-8"><VacancyForm aiAvailable={isAiImproveAvailable()} locale={locale} initial={{ id: vacancy.id, version: vacancy.version, title: vacancy.title, locationLabel: vacancy.locationLabel, workMode: vacancy.workMode, minHours: vacancy.minHours, maxHours: vacancy.maxHours, salaryMin: vacancy.salaryMin, salaryMax: vacancy.salaryMax, salaryVisible: vacancy.salaryVisible, sections: vacancy.sections }} labels={{ ...aiLabels, title: t('vacancy.title'), location: t('vacancy.location'), workMode: t('vacancy.workMode'), onSite: t('vacancy.onSite'), hybrid: t('vacancy.hybrid'), remote: t('vacancy.remote'), hours: t('vacancy.hours'), salary: t('vacancy.salary'), salaryVisible: t('vacancy.salaryVisible'), sections: t('vacancy.sections'), sectionHint: t('vacancy.sectionHint'), save: t('vacancy.save'), saving: t('vacancy.saving'), cancel: t('vacancy.cancel'), saved: t('vacancy.saved'), invalid: t('vacancy.invalid') }} /></section></div>
}
