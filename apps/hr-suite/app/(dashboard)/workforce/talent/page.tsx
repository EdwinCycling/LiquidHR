import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentEmployeeCapabilityRecords } from '@/components/talent/talent-employee-capability-records'
import { TalentWorkforceViewer } from '@/components/talent/talent-workforce-viewer'
import { TalentNotificationPanel } from '@/components/talent/talent-notification-panel'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentEmployeeCapabilityRecords } from '@/lib/talent/employee-capability-service'
import { listTalentProfilesForWorkforce } from '@/lib/talent/service'

export default async function WorkforceTalentPage() {
  try { await requirePermission('talent:manager-read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }

  const [t, results] = await Promise.all([
    getTranslator('talent'),
    Promise.allSettled([listTalentProfilesForWorkforce(), listTalentEmployeeCapabilityRecords({})]),
  ])
  const profileResult = results[0]
  const recordResult = results[1]
  const initial = profileResult.status === 'fulfilled' ? profileResult.value : []
  const records = recordResult.status === 'fulfilled' ? recordResult.value : []
  const overview = {
    searchPlaceholder: t('overview.searchPlaceholder'),
    employeeFilter: t('overview.employeeFilter'),
    allEmployees: t('overview.allEmployees'),
    employeeContext: t('overview.employeeContext'),
    noEmployees: t('overview.noEmployees'),
    employeeCount: t('overview.employeeCount'),
    profileCount: t('overview.profileCount'),
    loadError: t('overview.loadError'),
  }
  const recordLabels = { title: t('personalRecordsTitle'), subtitle: t('personalRecordsSubtitle'), add: t('personalRecordAdd'), edit: t('personalRecordEdit'), save: t('personalRecordSave'), cancel: t('personalRecordCancel'), failed: t('personalRecordFailed'), empty: t('personalRecordEmpty'), noResults: t('personalRecordNoResults'), search: t('personalRecordSearch'), searchPlaceholder: t('personalRecordSearchPlaceholder'), employee: t('personalRecordEmployee'), capability: t('personalRecordCapability'), type: t('personalRecordType'), level: t('personalRecordLevel'), languageLevel: t('personalRecordLanguageLevel'), nativeLanguage: t('personalRecordNativeLanguage'), certificateStatus: t('personalRecordCertificateStatus'), certificateIssuer: t('personalRecordCertificateIssuer'), certificateCode: t('personalRecordCertificateCode'), certificateValidityMonths: t('personalRecordCertificateValidityMonths'), renewalRequired: t('personalRecordRenewalRequired'), evidenceStatus: t('personalRecordEvidenceStatus'), evidenceStatusNotProvided: t('personalRecordEvidenceStatusNotProvided'), evidenceStatusPending: t('personalRecordEvidenceStatusPending'), evidenceStatusVerified: t('personalRecordEvidenceStatusVerified'), evidenceStatusRejected: t('personalRecordEvidenceStatusRejected'), evidenceStatusExpired: t('personalRecordEvidenceStatusExpired'), responsible: t('personalRecordResponsible'), responsibleAssigned: t('personalRecordResponsibleAssigned'), responsibleMissing: t('personalRecordResponsibleMissing'), validFrom: t('personalRecordValidFrom'), validUntil: t('personalRecordValidUntil'), source: t('personalRecordSource'), status: t('personalRecordStatus'), evidence: t('personalRecordEvidence'), evidencePresent: t('personalRecordEvidencePresent'), noEvidence: t('personalRecordNoEvidence'), readOnly: t('personalRecordReadOnly'), draftPolicy: t('personalRecordDraftPolicy'), all: t('personalRecordAll'), validityFilter: t('personalRecordValidityFilter'), expiringSoon: t('personalRecordExpiringSoon'), archiveImpact: t('personalRecordArchiveImpact'), typeCompetency: t('personalRecordTypeCompetency'), typeSkill: t('personalRecordTypeSkill'), typeKnowledge: t('personalRecordTypeKnowledge'), typeLanguage: t('personalRecordTypeLanguage'), typeCertificate: t('personalRecordTypeCertificate'), statusDraft: t('personalRecordStatusDraft'), statusReleased: t('personalRecordStatusReleased'), statusExpired: t('personalRecordStatusExpired'), statusArchived: t('personalRecordStatusArchived'), sourceSelf: t('personalRecordSourceSelf'), sourceHr: t('personalRecordSourceHr'), sourceManager: t('personalRecordSourceManager'), sourceImported: t('personalRecordSourceImported'), certificateValid: t('personalRecordCertificateValid'), certificateExpired: t('personalRecordCertificateExpired'), certificatePermanent: t('personalRecordCertificatePermanent'), certificateRevoked: t('personalRecordCertificateRevoked'), close: t('personalRecordClose'), loadError: overview.loadError }

  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
    <AdminSettingsPageHeader backHref="/workforce" backLabel={t('backToWorkforce')} eyebrow={t('workforceTitle')} subtitle={t('workforceSubtitle')} title={t('workforceTitle')} />
    <nav aria-label={t('teamMatrixTitle')} className="mt-5 flex flex-wrap gap-2">
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/assessments">{t('assessmentTitle')}</Link>
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/team">{t('teamMatrixTitle')}</Link>
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/comparison">{t('comparisonTitle')}</Link>
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/role-explorer">{t('roleExplorerTitle')}</Link>
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/goals">{t('goalTitle')}</Link>
      <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/reports">{t('reportTitle')}</Link>
    </nav>
    <TalentNotificationPanel labels={{ title: t('notificationTitle'), intro: t('notificationIntro'), empty: t('notificationEmpty'), loading: t('overview.notificationLoading'), retry: t('overview.notificationRetry'), markRead: t('notificationMarkRead'), complete: t('notificationComplete'), dismiss: t('notificationDismiss'), openAction: t('overview.notificationOpenAction'), saved: t('notificationSaved'), failed: t('notificationFailed'), statusOpen: t('overview.notificationStatusOpen'), statusRead: t('overview.notificationStatusRead'), statusDone: t('overview.notificationStatusDone'), statusDismissed: t('overview.notificationStatusDismissed') }} />
    <TalentWorkforceViewer initial={initial} state={profileResult.status === 'fulfilled' ? 'ready' : 'error'} labels={{ ...overview, search: t('search'), profiles: t('profiles'), empty: t('workforceEmpty'), noResults: t('noResults'), selectProfile: t('selectProfile'), managerReadOnlyHint: t('managerReadOnlyHint'), profileDetails: t('profileDetails'), profileContent: t('profileContent'), requirements: t('requirements'), purpose: t('purpose'), summary: t('summary'), organizationalContext: t('organizationalContext'), tasks: t('tasks'), responsibilities: t('responsibilities'), resultAreas: t('resultAreas'), capabilityType: t('type'), required: t('required'), important: t('important'), optional: t('optional'), targetLevel: t('targetLevel'), languageLevel: t('languageLevel'), rationale: t('rationale'), noContent: t('noContent'), noRequirements: t('noRequirements'), readOnly: t('readOnly'), active: t('active'), validFrom: t('validFrom'), validUntil: t('validUntil'), family: t('family'), seniority: t('seniority'), notAvailable: t('notAvailable') }} />
    <TalentEmployeeCapabilityRecords mode="manager" initial={records} state={recordResult.status === 'fulfilled' ? 'ready' : 'error'} labels={recordLabels} />
  </section>
}
