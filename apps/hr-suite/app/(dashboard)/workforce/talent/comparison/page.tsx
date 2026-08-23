import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentComparisonWorkspace } from '@/components/talent/talent-comparison-workspace'
import { EmptyState } from '@/components/ui/empty-state'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { talentComparisonListQuerySchema } from '@/lib/talent/comparison-schemas'
import { listTalentComparisonWorkspace, TalentComparisonError } from '@/lib/talent/comparison-service'

export default async function WorkforceTalentComparisonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requirePermission('talent-comparison:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const params = await searchParams
  const parsed = talentComparisonListQuerySchema.safeParse({ employeeId: typeof params.employeeId === 'string' ? params.employeeId : undefined, profileVersionId: typeof params.profileVersionId === 'string' ? params.profileVersionId : undefined })
  const t = await getTranslator('talent')
  const labels = { title: t('comparisonTitle'), subtitle: t('comparisonManagerSubtitle'), employee: t('comparisonEmployee'), employeeNumber: t('comparisonEmployeeNumber'), profile: t('comparisonProfile'), profileVersion: t('comparisonProfileVersion'), capability: t('capability'), typeCompetency: t('typeCompetency'), typeSkill: t('typeSkill'), typeKnowledge: t('typeKnowledge'), typeLanguage: t('typeLanguage'), typeCertificate: t('typeCertificate'), required: t('required'), important: t('important'), optional: t('optional'), sourceSelf: t('personalRecordSourceSelf'), sourceHr: t('personalRecordSourceHr'), sourceManager: t('personalRecordSourceManager'), sourceImported: t('personalRecordSourceImported'), chooseEmployee: t('comparisonChooseEmployee'), chooseProfile: t('comparisonChooseProfile'), search: t('comparisonSearch'), compare: t('comparisonCompare'), empty: t('comparisonEmpty'), noEmployees: t('comparisonNoEmployees'), noProfiles: t('comparisonNoProfiles'), noRequirements: t('comparisonNoRequirements'), loadFailed: t('comparisonLoadFailed'), loadFailedDescription: t('comparisonLoadFailedDescription'), requirements: t('comparisonRequirements'), target: t('comparisonTarget'), current: t('comparisonCurrent'), requirementType: t('comparisonRequirementType'), rationale: t('comparisonRationale'), match: t('comparisonMatch'), gap: t('comparisonGap'), missingEvidence: t('comparisonMissingEvidence'), unknown: t('comparisonUnknown'), sourceVersion: t('comparisonSourceVersion'), sourceRecord: t('comparisonSourceRecord'), noSourceRecord: t('comparisonNoSourceRecord'), sourceType: t('comparisonSourceType'), validity: t('comparisonValidity'), noCurrentRecord: t('comparisonNoCurrentRecord'), jobGroup: t('comparisonJobGroup'), currentJob: t('comparisonCurrentJob'), currentScope: t('comparisonCurrentScope'), asOf: t('comparisonAsOf'), openEmployee: t('comparisonOpenEmployee'), openProfile: t('comparisonOpenProfile') }
  let initial: Awaited<ReturnType<typeof listTalentComparisonWorkspace>> | null = null
  let loadFailed = false
  try {
    initial = await listTalentComparisonWorkspace(parsed.success ? parsed.data : {})
  } catch (error) {
    if (error instanceof TalentComparisonError && error.status === 403) redirect('/geen-toegang')
    loadFailed = true
  }
  if (loadFailed || !initial) return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/workforce/talent" backLabel={t('backToWorkforce')} title={t('comparisonTitle')} subtitle={t('comparisonManagerSubtitle')} /><EmptyState className="mt-6" title={t('comparisonLoadFailed')} description={t('comparisonLoadFailedDescription')} /></section>
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/workforce/talent" backLabel={t('backToWorkforce')} title={t('comparisonTitle')} subtitle={t('comparisonManagerSubtitle')} /><TalentComparisonWorkspace key={`${initial.selectedEmployeeId ?? ''}:${initial.selectedProfileVersionId ?? ''}`} action="/workforce/talent/comparison" initial={initial} labels={labels} profileHref="/workforce/talent" /></section>
}
