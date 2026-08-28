import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentEmployeeCapabilityRecords } from '@/components/talent/talent-employee-capability-records'
import { TalentReadOnlyProfile } from '@/components/talent/talent-read-only-profile'
import { TalentNotificationPanel } from '@/components/talent/talent-notification-panel'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getMyTalentEmployeeCapabilityOptions, listMyTalentEmployeeCapabilityRecords } from '@/lib/talent/employee-capability-service'
import { getMyTalentProfile } from '@/lib/talent/service'

export default async function MyTalentPage() {
  try { await requirePermission('self:talent:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [profile, records, recordOptions, t] = await Promise.all([getMyTalentProfile(), listMyTalentEmployeeCapabilityRecords(), getMyTalentEmployeeCapabilityOptions(), getTranslator('talent')])
  const readOnlyProfile = profile ? {
    id: profile.job_profile_id,
    jobCode: profile.job_code,
    groupCode: profile.job_group_code,
    groupName: profile.job_group_name,
    familyName: profile.job_family_name,
    seniorityName: profile.seniority_name,
    status: profile.status,
    validFrom: profile.valid_from,
    validUntil: profile.valid_until,
    purpose: profile.purpose,
    summary: profile.summary,
    organizationalContext: profile.organizational_context,
    tasks: profile.tasks,
    responsibilities: profile.responsibilities,
    resultAreas: profile.result_areas,
    requirements: profile.requirements.map((requirement) => ({
      id: requirement.id,
      capabilityCode: requirement.capability_code,
      capabilityName: requirement.capability_name,
      capabilityType: requirement.capability_type,
      requirementType: requirement.requirement_type,
      targetLevelCode: requirement.target_level_code,
      targetLevelName: requirement.target_level_name,
      languageLevel: requirement.language_level,
      rationale: requirement.rationale,
    })),
  } : null
  const labels = { profileDetails: t('profileDetails'), profileContent: t('profileContent'), requirements: t('requirements'), purpose: t('purpose'), summary: t('summary'), organizationalContext: t('organizationalContext'), tasks: t('tasks'), responsibilities: t('responsibilities'), resultAreas: t('resultAreas'), capabilityType: t('type'), required: t('required'), important: t('important'), optional: t('optional'), targetLevel: t('targetLevel'), languageLevel: t('languageLevel'), rationale: t('rationale'), noContent: t('noContent'), noRequirements: t('noRequirements'), readOnly: t('readOnly'), active: t('active'), validFrom: t('validFrom'), validUntil: t('validUntil'), family: t('family'), seniority: t('seniority'), notAvailable: t('notAvailable') }
  const recordLabels = { title: t('personalRecordsTitle'), subtitle: t('personalRecordsSubtitle'), add: t('personalRecordAdd'), edit: t('personalRecordEdit'), save: t('personalRecordSave'), cancel: t('personalRecordCancel'), failed: t('personalRecordFailed'), empty: t('personalRecordEmpty'), noResults: t('personalRecordNoResults'), search: t('personalRecordSearch'), searchPlaceholder: t('personalRecordSearchPlaceholder'), employee: t('personalRecordEmployee'), capability: t('personalRecordCapability'), type: t('personalRecordType'), level: t('personalRecordLevel'), languageLevel: t('personalRecordLanguageLevel'), nativeLanguage: t('personalRecordNativeLanguage'), certificateStatus: t('personalRecordCertificateStatus'), certificateIssuer: t('personalRecordCertificateIssuer'), certificateCode: t('personalRecordCertificateCode'), certificateValidityMonths: t('personalRecordCertificateValidityMonths'), renewalRequired: t('personalRecordRenewalRequired'), evidenceStatus: t('personalRecordEvidenceStatus'), evidenceStatusNotProvided: t('personalRecordEvidenceStatusNotProvided'), evidenceStatusPending: t('personalRecordEvidenceStatusPending'), evidenceStatusVerified: t('personalRecordEvidenceStatusVerified'), evidenceStatusRejected: t('personalRecordEvidenceStatusRejected'), evidenceStatusExpired: t('personalRecordEvidenceStatusExpired'), responsible: t('personalRecordResponsible'), responsibleAssigned: t('personalRecordResponsibleAssigned'), responsibleMissing: t('personalRecordResponsibleMissing'), validFrom: t('personalRecordValidFrom'), validUntil: t('personalRecordValidUntil'), source: t('personalRecordSource'), status: t('personalRecordStatus'), evidence: t('personalRecordEvidence'), evidencePresent: t('personalRecordEvidencePresent'), noEvidence: t('personalRecordNoEvidence'), readOnly: t('personalRecordReadOnly'), draftPolicy: t('personalRecordDraftPolicy'), all: t('personalRecordAll'), validityFilter: t('personalRecordValidityFilter'), expiringSoon: t('personalRecordExpiringSoon'), archiveImpact: t('personalRecordArchiveImpact'), typeCompetency: t('personalRecordTypeCompetency'), typeSkill: t('personalRecordTypeSkill'), typeKnowledge: t('personalRecordTypeKnowledge'), typeLanguage: t('personalRecordTypeLanguage'), typeCertificate: t('personalRecordTypeCertificate'), statusDraft: t('personalRecordStatusDraft'), statusReleased: t('personalRecordStatusReleased'), statusExpired: t('personalRecordStatusExpired'), statusArchived: t('personalRecordStatusArchived'), sourceSelf: t('personalRecordSourceSelf'), sourceHr: t('personalRecordSourceHr'), sourceManager: t('personalRecordSourceManager'), sourceImported: t('personalRecordSourceImported'), certificateValid: t('personalRecordCertificateValid'), certificateExpired: t('personalRecordCertificateExpired'), certificatePermanent: t('personalRecordCertificatePermanent'), certificateRevoked: t('personalRecordCertificateRevoked'), close: t('personalRecordClose') }
  return <section className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/dashboard/start" backLabel={t('backToDashboard')} eyebrow={t('myTitle')} subtitle={t('mySubtitle')} title={t('myTitle')} /><nav aria-label={t('assessmentTitle')} className="mt-5 flex flex-wrap gap-2"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-talent/assessments">{t('assessmentTitle')}</Link><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-talent/role-explorer">{t('roleExplorerTitle')}</Link><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-talent/goals">{t('goalTitle')}</Link><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-talent/reports">{t('reportTitle')}</Link></nav><TalentNotificationPanel labels={{ title: t('notificationTitle'), intro: t('notificationIntro'), empty: t('notificationEmpty'), markRead: t('notificationMarkRead'), complete: t('notificationComplete'), dismiss: t('notificationDismiss'), saved: t('notificationSaved'), failed: t('notificationFailed') }} />{readOnlyProfile ? <div className="mt-6"><TalentReadOnlyProfile labels={labels} profile={readOnlyProfile} /></div> : <Surface className="mt-6 border-dashed p-6 text-sm text-muted-foreground" variant="subtle">{t('myProfileEmpty')}</Surface>}<TalentEmployeeCapabilityRecords mode="self" initial={records} options={recordOptions} labels={recordLabels} /></section>
}
