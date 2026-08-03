import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentRoleExplorer } from '@/components/talent/talent-role-explorer'
import { AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { talentRoleExplorerListQuerySchema } from '@/lib/talent/role-explorer-schemas'
import { listTalentRoleExplorerWorkspace } from '@/lib/talent/role-explorer-service'

export default async function MyTalentRoleExplorerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try {
    const context = await requireAuthContext()
    await requirePermission('talent-comparison:read', context.employeeId ?? undefined)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const params = await searchParams
  const parsed = talentRoleExplorerListQuerySchema.safeParse({ profileVersionId: typeof params.profileVersionId === 'string' ? params.profileVersionId : undefined })
  const [initial, t] = await Promise.all([listTalentRoleExplorerWorkspace('self', parsed.success ? parsed.data : {}), getTranslator('talent')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/my-talent" backLabel={t('backToMyTalent')} title={t('roleExplorerTitle')} subtitle={t('roleExplorerSelfSubtitle')} /><TalentRoleExplorer action="/my-talent/role-explorer" mode="self" initial={initial} labels={{ title: t('roleExplorerTitle'), subtitle: t('roleExplorerSelfSubtitle'), employee: t('roleExplorerEmployee'), profile: t('roleExplorerProfile'), chooseEmployee: t('roleExplorerChooseEmployee'), chooseProfile: t('roleExplorerChooseProfile'), compare: t('roleExplorerCompare'), empty: t('roleExplorerEmpty'), chooseTarget: t('roleExplorerChooseTarget'), asOf: t('roleExplorerAsOf'), profileVersion: t('roleExplorerProfileVersion'), current: t('roleExplorerCurrent'), target: t('roleExplorerTarget'), status: t('roleExplorerStatus'), source: t('roleExplorerSource'), validity: t('roleExplorerValidity'), radarDescription: t('roleExplorerRadarDescription'), table: t('roleExplorerTable'), capability: t('roleExplorerCapability'), type: t('roleExplorerType'), reason: t('roleExplorerReason'), readOnly: t('roleExplorerReadOnly'), scope: t('roleExplorerScope'), noSource: t('roleExplorerNoSource'), noCurrentRecord: t('roleExplorerNoCurrentRecord'), match: t('comparisonMatch'), gap: t('comparisonGap'), missingEvidence: t('comparisonMissingEvidence'), unknown: t('comparisonUnknown'), currentJob: t('roleExplorerCurrentJob') }} /></section>
}
