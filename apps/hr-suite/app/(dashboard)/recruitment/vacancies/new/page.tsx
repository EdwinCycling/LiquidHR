import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { VacancyForm } from '@/components/recruitment/vacancy-form'

export default async function NewRecruitmentVacancyPage() {
  try { await requireTenantModule('RECRUITMENT'); await requirePermission('recruitment-vacancy:write') } catch (error) { if (error instanceof ModuleError && error.status === 404) notFound(); if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const t = await getTranslator('recruitment')
  return <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('vacancy.newTitle')}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{t('vacancy.sectionHint')}</p><section className="mt-8 rounded-xl border bg-surface p-5 sm:p-8"><VacancyForm labels={{ title: t('vacancy.title'), location: t('vacancy.location'), workMode: t('vacancy.workMode'), onSite: t('vacancy.onSite'), hybrid: t('vacancy.hybrid'), remote: t('vacancy.remote'), hours: t('vacancy.hours'), salary: t('vacancy.salary'), salaryVisible: t('vacancy.salaryVisible'), sections: t('vacancy.sections'), sectionHint: t('vacancy.sectionHint'), save: t('vacancy.save'), saving: t('vacancy.saving'), cancel: t('vacancy.cancel'), saved: t('vacancy.saved'), invalid: t('vacancy.invalid') }} /></section></div>
}
