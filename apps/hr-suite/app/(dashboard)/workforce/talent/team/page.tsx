import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentTeamMatrix } from '@/components/talent/talent-team-matrix'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export default async function WorkforceTalentTeamPage() {
  try { await requirePermission('talent-team:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentTeamMatrix(), getTranslator('talent')])
  const subtitle = initial.scopeType === 'TENANT' ? t('teamMatrixHrSubtitle') : t('teamMatrixManagerSubtitle')
  const labels = { title: t('teamMatrixTitle'), subtitle, search: t('teamMatrixSearch'), searchPlaceholder: t('teamMatrixSearchPlaceholder'), type: t('teamMatrixType'), status: t('teamMatrixStatus'), validity: t('teamMatrixValidity'), source: t('teamMatrixSource'), all: t('teamMatrixAll'), noResults: t('teamMatrixNoResults'), empty: t('teamMatrixEmpty'), employee: t('teamMatrixEmployee'), job: t('teamMatrixJob'), capabilities: t('teamMatrixCapabilities'), noCapabilities: t('teamMatrixNoCapabilities'), draft: t('personalRecordStatusDraft'), released: t('personalRecordStatusReleased'), expired: t('personalRecordStatusExpired'), self: t('personalRecordSourceSelf'), hr: t('personalRecordSourceHr'), manager: t('personalRecordSourceManager'), imported: t('personalRecordSourceImported'), scope: t('teamMatrixScope'), teamScope: t('teamMatrixTeamScope'), tenantScope: t('teamMatrixTenantScope'), employeeDrilldown: t('teamMatrixEmployeeDrilldown'), aggregateDisabled: t('teamMatrixAggregateDisabled'), filterSearch: t('teamMatrixFilterSearch'), filterNoOptions: t('teamMatrixFilterNoOptions'), typeCompetency: t('personalRecordTypeCompetency'), typeSkill: t('personalRecordTypeSkill'), typeKnowledge: t('personalRecordTypeKnowledge'), typeLanguage: t('personalRecordTypeLanguage'), typeCertificate: t('personalRecordTypeCertificate'), evidence: t('personalRecordEvidence'), evidencePresent: t('personalRecordEvidencePresent'), noEvidence: t('personalRecordNoEvidence') }
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/workforce/talent" backLabel={t('backToWorkforceTalent')} title={t('teamMatrixTitle')} subtitle={subtitle} /><TalentTeamMatrix initial={initial} labels={labels} /></section>
}
