import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'
import { listRecruitmentApplications } from '@/lib/recruitment/application-service'
import { RecruitmentVacancyDetail } from '@/components/recruitment/recruitment-vacancy-detail'

export default async function RecruitmentVacancyDetailPage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  try {
    await requireTenantModule('RECRUITMENT')
    await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read'])
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const { vacancyId } = await params
  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  const vacancy = await getRecruitmentVacancy(context, vacancyId, supabase)
  if (!vacancy) notFound()

  const canReadCandidates = context.permissions.includes('recruitment-candidate:read')
  const applications = canReadCandidates ? await listRecruitmentApplications(context, vacancy.id, supabase) : []

  return (
    <RecruitmentVacancyDetail
      applications={applications}
      canManageApplications={context.permissions.includes('recruitment-candidate:write')}
      canPublish={context.permissions.includes('recruitment-vacancy:publish')}
      canWrite={context.permissions.includes('recruitment-vacancy:write')}
      labels={{
        eyebrow: t('eyebrow'),
        back: t('detail.back'),
        edit: t('vacancy.editTitle'),
        status: t('detail.status'),
        statusDraft: t('vacancy.statusDraft'),
        statusActive: t('vacancy.statusActive'),
        statusClosed: t('vacancy.statusClosed'),
        statusArchived: t('vacancy.statusArchived'),
        updatedAt: t('detail.updatedAt'),
        version: t('detail.version'),
        vacancyData: t('detail.vacancyData'),
        title: t('vacancy.title'),
        location: t('vacancy.location'),
        workMode: t('vacancy.workMode'),
        onSite: t('vacancy.onSite'),
        hybrid: t('vacancy.hybrid'),
        remote: t('vacancy.remote'),
        hours: t('vacancy.hours'),
        salary: t('vacancy.salary'),
        salaryVisible: t('vacancy.salaryVisible'),
        salaryHidden: t('vacancy.salaryHidden'),
        content: t('detail.content'),
        emptyContent: t('detail.emptyContent'),
        applications: t('overview.applications'),
        noCandidateAccess: t('detail.noCandidateAccess'),
        invalid: t('vacancy.invalid'),
        conflict: t('vacancy.conflict'),
        error: t('vacancy.saveError'),
        saved: t('vacancy.saved'),
        close: t('vacancy.cancel'),
        sectionTitle: t('vacancy.sectionTitle'),
        sectionContent: t('vacancy.sectionContent'),
        sectionVisible: t('vacancy.sectionVisible'),
        sectionHint: t('vacancy.sectionHint'),
        save: t('vacancy.save'),
        saving: t('vacancy.saving'),
        discardTitle: t('vacancy.discardTitle'),
        discardDescription: t('vacancy.discardDescription'),
        discardConfirm: t('vacancy.discardConfirm'),
        discardCancel: t('vacancy.discardCancel'),
        pipeline: {
          title: t('pipeline.title'),
          allStages: t('pipeline.allStages'),
          empty: t('pipeline.empty'),
          candidate: t('pipeline.candidate'),
          stage: t('pipeline.stage'),
          source: t('pipeline.source'),
          possibleDuplicate: t('pipeline.possibleDuplicate'),
          move: t('pipeline.move'),
          reject: t('pipeline.reject'),
          reopen: t('pipeline.reopen'),
          hire: t('pipeline.hire'),
        },
        manual: {
          title: t('manual.title'),
          firstName: t('manual.firstName'),
          lastName: t('manual.lastName'),
          email: t('manual.email'),
          phone: t('manual.phone'),
          motivation: t('manual.motivation'),
          save: t('manual.save'),
          saving: t('manual.saving'),
          saved: t('manual.saved'),
          error: t('manual.error'),
        },
        publication: {
          title: t('vacancy.publication'),
          statusDraft: t('vacancy.publicationStatusDraft'),
          statusOpen: t('vacancy.publicationStatusOpen'),
          statusClosed: t('vacancy.publicationStatusClosed'),
          statusArchived: t('vacancy.publicationStatusArchived'),
          publish: t('vacancy.publish'),
          close: t('vacancy.close'),
          reopen: t('vacancy.reopen'),
          archive: t('vacancy.archive'),
          formTitle: t('vacancy.formTitle'),
          phone: t('vacancy.phone'),
          cv: t('vacancy.cv'),
          motivation: t('vacancy.motivation'),
          hidden: t('vacancy.hidden'),
          optional: t('vacancy.optional'),
          required: t('vacancy.required'),
          save: t('vacancy.save'),
          slug: t('vacancy.slug'),
          publicLink: t('vacancy.publicLink'),
          error: t('vacancy.publicationError'),
          closeLabel: t('vacancy.cancel'),
          discardTitle: t('vacancy.discardTitle'),
          discardDescription: t('vacancy.discardDescription'),
          discardConfirm: t('vacancy.discardConfirm'),
          discardCancel: t('vacancy.discardCancel'),
          confirmCloseTitle: t('vacancy.confirmCloseTitle'),
          confirmCloseDescription: t('vacancy.confirmCloseDescription'),
          confirmArchiveTitle: t('vacancy.confirmArchiveTitle'),
          confirmArchiveDescription: t('vacancy.confirmArchiveDescription'),
          confirm: t('vacancy.confirm'),
        },
      }}
      vacancy={vacancy}
    />
  )
}
