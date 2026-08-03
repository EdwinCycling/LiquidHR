import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentComparisonWorkspace } from '@/components/talent/talent-comparison-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { talentComparisonListQuerySchema } from '@/lib/talent/comparison-schemas'
import { listTalentComparisonWorkspace } from '@/lib/talent/comparison-service'

export default async function WorkforceTalentComparisonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requirePermission('talent-comparison:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const params = await searchParams
  const parsed = talentComparisonListQuerySchema.safeParse({ employeeId: typeof params.employeeId === 'string' ? params.employeeId : undefined, profileVersionId: typeof params.profileVersionId === 'string' ? params.profileVersionId : undefined })
  const [initial, t] = await Promise.all([listTalentComparisonWorkspace(parsed.success ? parsed.data : {}), getTranslator('talent')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/workforce/talent" backLabel={t('backToWorkforce')} title={t('comparisonTitle')} subtitle={t('comparisonManagerSubtitle')} /><TalentComparisonWorkspace action="/workforce/talent/comparison" initial={initial} labels={{ title: t('comparisonTitle'), subtitle: t('comparisonManagerSubtitle'), employee: t('comparisonEmployee'), profile: t('comparisonProfile'), chooseEmployee: t('comparisonChooseEmployee'), chooseProfile: t('comparisonChooseProfile'), compare: t('comparisonCompare'), empty: t('comparisonEmpty'), requirements: t('comparisonRequirements'), match: t('comparisonMatch'), gap: t('comparisonGap'), missingEvidence: t('comparisonMissingEvidence'), unknown: t('comparisonUnknown'), sourceVersion: t('comparisonSourceVersion'), sourceRecord: t('comparisonSourceRecord'), noSourceRecord: t('comparisonNoSourceRecord'), jobGroup: t('comparisonJobGroup'), currentScope: t('comparisonCurrentScope') }} /></section>
}
