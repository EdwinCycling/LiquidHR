import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentNotificationPanel } from '@/components/talent/talent-notification-panel'
import { TalentWorkforceOverview } from '@/components/talent/talent-workforce-overview'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentEmployeeCapabilityRecords } from '@/lib/talent/employee-capability-service'
import { listTalentProfilesForWorkforce } from '@/lib/talent/service'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export default async function WorkforceTalentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission('talent:manager-read').catch((error: unknown) => { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error })
  const params = await searchParams
  const canTeam = context.permissions.includes('talent-team:read')
  const canCompare = context.permissions.includes('talent-comparison:read')
  const canManage = context.permissions.includes('talent:manage')

  const [t, results] = await Promise.all([
    getTranslator('talent'),
    Promise.allSettled([listTalentProfilesForWorkforce(), listTalentEmployeeCapabilityRecords({}), canTeam ? listTalentTeamMatrix({}, { includeCapabilities: false }) : Promise.resolve(null)]),
  ])
  const profileResult = results[0]
  const recordResult = results[1]
  const teamResult = results[2]
  const initial = profileResult.status === 'fulfilled' ? profileResult.value : []
  const records = recordResult.status === 'fulfilled' ? recordResult.value : []
  const team = teamResult.status === 'fulfilled' ? teamResult.value : null
  const employees = canTeam && team ? team.rows.map(({ employeeId, employeeNumber, employeeLabel, jobTitle, departmentName }) => ({ employeeId, employeeNumber, employeeLabel, jobTitle, departmentName })) : []
  const employeeState = !canTeam || teamResult.status === 'fulfilled' ? 'ready' : 'error'
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
  const workforceOverviewLabels = {
    tabsAriaLabel: t('overview.tabsAriaLabel'),
    previousTab: t('overview.previousTab'),
    nextTab: t('overview.nextTab'),
    employeesTab: t('overview.employeesTab'),
    profilesTab: t('overview.profilesTab'),
    skillsEvidenceTab: t('overview.skillsEvidenceTab'),
    compareDevelopTab: t('overview.compareDevelopTab'),
    employeeDirectory: {
      title: t('overview.employeeDirectoryTitle'),
      description: t('overview.employeeDirectoryDescription'),
      search: t('overview.employeeSearch'),
      searchPlaceholder: t('overview.employeeSearchPlaceholder'),
      employeeNumber: t('overview.employeeNumber'),
      job: t('overview.employeeJob'),
      department: t('overview.employeeDepartment'),
      employeeCount: overview.employeeCount,
      selectEmployee: t('overview.selectEmployee'),
      selectedEmployee: t('overview.selectedEmployee'),
      openEmployee: t('overview.openEmployee'),
      teamMatrix: t('overview.teamMatrix'),
      noEmployees: t('overview.noEmployeesAvailable'),
      noResults: t('overview.noEmployeeResults'),
      loadError: overview.loadError,
    },
    development: {
      title: t('overview.developmentTitle'),
      description: t('overview.developmentDescription'),
      selectedEmployee: t('overview.selectedEmployee'),
      noEmployeeSelected: t('overview.noEmployeeSelected'),
      currentJob: t('overview.employeeJob'),
      department: t('overview.employeeDepartment'),
      comparisonTitle: t('comparisonTitle'),
      comparisonDescription: t('comparisonManagerSubtitle'),
      openComparison: t('overview.openComparison'),
      roleExplorerTitle: t('roleExplorerTitle'),
      roleExplorerDescription: t('roleExplorerManagerSubtitle'),
      openRoleExplorer: t('overview.openRoleExplorer'),
    },
    profileLabels: { ...overview, search: t('search'), profiles: t('profiles'), empty: t('workforceEmpty'), noResults: t('noResults'), selectProfile: t('selectProfile'), managerReadOnlyHint: t('managerReadOnlyHint'), profileDetails: t('profileDetails'), profileContent: t('profileContent'), requirements: t('requirements'), purpose: t('purpose'), summary: t('summary'), organizationalContext: t('organizationalContext'), tasks: t('tasks'), responsibilities: t('responsibilities'), resultAreas: t('resultAreas'), capabilityType: t('type'), required: t('required'), important: t('important'), optional: t('optional'), targetLevel: t('targetLevel'), languageLevel: t('languageLevel'), rationale: t('rationale'), noContent: t('noContent'), noRequirements: t('noRequirements'), readOnly: t('readOnly'), active: t('active'), validFrom: t('validFrom'), validUntil: t('validUntil'), family: t('family'), seniority: t('seniority'), notAvailable: t('notAvailable') },
    recordLabels,
    manageProfiles: t('overview.manageProfiles'),
    manageSkills: t('overview.manageSkills'),
  }

  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
    <AdminSettingsPageHeader backHref="/workforce" backLabel={t('backToWorkforce')} eyebrow={t('workforceTitle')} subtitle={t('workforceSubtitle')} title={t('workforceTitle')} />
    <TalentNotificationPanel labels={{ title: t('notificationTitle'), intro: t('notificationIntro'), empty: t('notificationEmpty'), loading: t('overview.notificationLoading'), retry: t('overview.notificationRetry'), markRead: t('notificationMarkRead'), complete: t('notificationComplete'), dismiss: t('notificationDismiss'), openAction: t('overview.notificationOpenAction'), saved: t('notificationSaved'), failed: t('notificationFailed'), statusOpen: t('overview.notificationStatusOpen'), statusRead: t('overview.notificationStatusRead'), statusDone: t('overview.notificationStatusDone'), statusDismissed: t('overview.notificationStatusDismissed') }} />
    <TalentWorkforceOverview canCompare={canCompare} canManage={canManage} canTeam={canTeam} employeeState={employeeState} employees={employees} initialArea={typeof params.area === 'string' ? params.area : undefined} initialEmployeeId={typeof params.employeeId === 'string' ? params.employeeId : undefined} labels={workforceOverviewLabels} profileState={profileResult.status === 'fulfilled' ? 'ready' : 'error'} profiles={initial} recordState={recordResult.status === 'fulfilled' ? 'ready' : 'error'} records={records} />
  </section>
}
