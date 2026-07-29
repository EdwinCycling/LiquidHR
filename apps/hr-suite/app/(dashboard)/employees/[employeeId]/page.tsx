import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, Mail, Phone } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmployeePersonCard } from '@/components/employees/employee-person-card'
import { EmployeeDashboard, type EmployeeDashboardDocument } from '@/components/employees/employee-dashboard'
import { EmailLink } from '@/components/shared/email-link'
import { EmployeeArchiveToggle } from '@/components/employees/employee-archive-toggle'
import { EmployeeAvatarManager } from '@/components/employees/employee-avatar-manager'
import { EmploymentCreateModal } from '@/components/employment/employment-create-modal'
import { EmploymentTimeline } from '@/components/employment/employment-timeline'
import { EmployeeDocumentDossier } from '@/components/documents/employee-document-dossier'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import {
  EmploymentServiceError,
  getEmployeeEmploymentDetail,
  getEmploymentCreationOptions,
} from '@/lib/employment/employment-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import { DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT, getEmployeeDashboardLayout } from '@/lib/preferences/employee-dashboard'
import { getEmployeeCustomFields } from '@/lib/custom-fields/service'
import { listEmployeeActivity } from '@/lib/employees/employee-activity-service'
import { getDocumentOptions, listEmployeeDocuments } from '@/lib/documents/document-service'
import { listEmployeePayslips } from '@/lib/documents/payslip-service'
import { EmployeePayslips } from '@/components/documents/employee-payslips'
import { listEmployeeReminders } from '@/lib/reminders/reminder-service'
import { EmployeeReminders } from '@/components/employees/employee-reminders'
import { listEmployeeRoleAssignments } from '@/lib/organization/management-service'
import { employeeNotesPermissionAllowed, listEmployeeNotes } from '@/lib/employees/employee-notes-service'
import { EmployeeNotes } from '@/components/employees/employee-notes'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { listEmployeeAbsence } from '@/lib/absence/service'

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ tab?: string; create?: string; view?: string }>
}

async function loadPageData(employeeId: string, tab: 'overview' | 'personal' | 'employments' | 'reminders' | 'documents' | 'payslips' | 'notes' | 'absence') {
  try {
    const detailScope = tab === 'overview' ? 'overview' : tab === 'personal' ? 'personal' : tab === 'employments' ? 'employments' : 'employments'
    const [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, canReadDashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity] = await Promise.all([
      getEmployeeEmploymentDetail(employeeId, detailScope, { includeSalary: tab !== 'overview' }),
      tab === 'personal' || tab === 'overview' ? getEmployeeCustomFields(employeeId) : Promise.resolve([]),
      tab === 'overview' || tab === 'reminders' ? listEmployeeReminders(employeeId).catch(() => []) : Promise.resolve([]),
      tab === 'personal' ? listEmployeeRoleAssignments(employeeId).catch(() => []) : Promise.resolve([]),
      tab === 'employments' || tab === 'overview' ? permissionAllowed('contract:write', employeeId) : Promise.resolve(false),
      getLocale(),
      getUserPreferences(),
      getTranslator('employees'),
      getTranslator('employment'),
      getTranslator('errors'),
      getTranslator('customFields'),
      getTranslator('documents'),
      tab === 'overview' ? permissionAllowed('document:read', employeeId) : Promise.resolve(false),
      tab === 'overview' ? getEmployeeDashboardLayout() : Promise.resolve(DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT),
      tab === 'overview' ? listEmployeeActivity(employeeId).catch(() => []) : Promise.resolve([]),
      tab === 'overview' ? permissionAllowed('employee-activity:write', employeeId) : Promise.resolve(false),
    ])
    const [canReadDocuments, canWriteDocuments, canDeleteDocuments] = tab === 'documents'
      ? await Promise.all([
        permissionAllowed('document:read', employeeId), permissionAllowed('document:write', employeeId), permissionAllowed('document:delete', employeeId),
      ])
      : [false, false, false]
    const creationOptions = canManageEmployments && tab === 'employments'
      ? await getEmploymentCreationOptions(employeeId)
      : null
    const [documents, documentOptions] = tab === 'documents' ? await Promise.all([
      canReadDocuments ? listEmployeeDocuments(employeeId) : Promise.resolve([]),
      canWriteDocuments ? getDocumentOptions(employeeId) : Promise.resolve(null),
    ]) : [[], null]
    const canReadPayslips = tab === 'payslips' ? await permissionAllowed('payslip:read', employeeId) : false
    const payslips = tab === 'payslips' && canReadPayslips ? await listEmployeePayslips(employeeId) : []
    const dashboardDocuments: EmployeeDashboardDocument[] = tab === 'overview' && canReadDashboardDocuments
      ? (await listEmployeeDocuments(employeeId)).filter((document) => document.deleted_at === null).slice(0, 3).map((document) => ({ id: document.id, title: document.title, expiresOn: document.expires_on, createdAt: document.created_at }))
      : []
    const absenceCases = tab === 'overview' || tab === 'absence' ? await listEmployeeAbsence(employeeId).catch(() => []) : []
    const base = [detail, customFields, reminders, roleAssignments, creationOptions, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases] as const
    const canReadNotes = await employeeNotesPermissionAllowed(employeeId)
    const [canWriteNotes, canDeleteNotes] = canReadNotes ? await Promise.all([permissionAllowed('employee-note:write', employeeId), permissionAllowed('employee-note:delete', employeeId)]) : [false, false]
    const notes = tab === 'notes' && canReadNotes ? await listEmployeeNotes(employeeId) : []
    return [...base, notes, canReadNotes, canWriteNotes, canDeleteNotes] as const
  } catch (error) {
    if (error instanceof EmploymentServiceError && error.status === 404) notFound()
    throw error
  }
}

async function permissionAllowed(permissionCode: string, employeeId: string): Promise<boolean> {
  try {
    await requirePermission(permissionCode, employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

export default async function EmployeeDetailPage({ params, searchParams }: EmployeeDetailPageProps) {
  const { employeeId } = await params
  const { tab: requestedTab, create, view } = await searchParams
  const tab = requestedTab === 'overview' || requestedTab === 'employments' || requestedTab === 'documents' || requestedTab === 'payslips' || requestedTab === 'reminders' || requestedTab === 'personal' || requestedTab === 'notes' || requestedTab === 'absence' ? requestedTab : 'overview'
  const [detail, customFields, reminders, roleAssignments, creationOptions, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases, notes, canReadNotes, canWriteNotes, canDeleteNotes] = await loadPageData(employeeId, tab)
  const compact = view === 'compact'
  const absenceOverview = absenceCases.find((item) => item.status === 'ACTIVE') ?? absenceCases.find((item) => item.status !== 'CLOSED') ?? absenceCases[0] ?? null
  const statusLabel = {
    ACTIVE_EMPLOYEE: tEmployment('active'), FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'), NEVER_EMPLOYED: tEmployees('external'),
  }[detail.status]

  return (
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/employees" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployees('title')}
        </Link>
        <div className={`relative mt-5 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary via-primary to-accent-foreground text-primary-foreground shadow-lg ${compact ? 'p-2.5' : 'p-5 sm:p-7'}`}>
          <div aria-hidden="true" className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-primary-foreground/10" />
          <div aria-hidden="true" className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full border border-primary-foreground/10" />
          <div className={`relative flex items-center justify-between ${compact ? 'gap-3' : 'flex-col gap-5 sm:flex-row sm:items-center'}`}>
            <div className="flex min-w-0 items-center gap-4">
              <EmployeeAvatarManager compact={compact} employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} gender={detail.employee.gender} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed') }} />
              <div className="min-w-0">
                {!compact && <p className="eyebrow text-primary-foreground/70">{detail.employee.employeeNumber}</p>}
                <h1 className={`${compact ? '' : 'mt-1'} truncate font-semibold tracking-tight ${compact ? 'text-base' : 'text-3xl'}`}>{detail.employee.firstName} {detail.employee.birthName}</h1>
              </div>
            </div>
            {!compact && <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              {detail.employee.isArchived && <span className="status-chip bg-warning-surface text-warning">{tEmployees('archived')}</span>}
              <span className={`status-chip ${detail.employee.isActive ? 'bg-success-surface text-success' : 'bg-accent text-accent-foreground'}`}>{statusLabel}</span>
              <Link prefetch={false} href={`/employees/${employeeId}?tab=${tab}&view=compact`} className="button-secondary border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20">{tEmployees('compact')}</Link>
              <EmployeeArchiveToggle employeeId={employeeId} archived={detail.employee.isArchived} hasActiveEmployment={detail.employments.some((employment) => employment.record_status === 'CONFIRMED')} labels={{ archive: tEmployees('archiveEmployee'), unarchive: tEmployees('unarchiveEmployee'), archiveTitle: tEmployees('archiveConfirmTitle'), unarchiveTitle: tEmployees('unarchiveConfirmTitle'), archiveBody: tEmployees('archiveConfirmBody'), archiveAction: tEmployees('archiveConfirmAction'), cancel: tEmployees('archiveCancel'), saved: tEmployees('archiveSaved'), failed: tEmployees('archiveFailed'), hasActiveEmployment: tEmployees('hasActiveEmployment') }} />
            </div>}
            {compact && <Link prefetch={false} href={`/employees/${employeeId}?tab=${tab}&view=expanded`} className="button-secondary border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20">{tEmployees('expand')}</Link>}
          </div>
          {!compact && <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-primary-foreground/20 pt-4 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4" />{(detail.employee.workEmail ?? detail.employee.privateEmail) ? <EmailLink className="text-primary-foreground/85 hover:text-primary-foreground hover:underline" email={detail.employee.workEmail ?? detail.employee.privateEmail ?? ''} /> : tEmployees('noEmail')}</span>
            {(detail.employee.workPhone ?? detail.employee.workMobile) && <a className="flex items-center gap-2 hover:text-primary-foreground" href={`tel:${detail.employee.workPhone ?? detail.employee.workMobile}`}><Phone aria-hidden="true" className="h-4 w-4" />{detail.employee.workPhone ?? detail.employee.workMobile}</a>}
            <span className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />{tEmployees('employmentCount', { count: detail.employments.length })}</span>
          </div>}
        </div>

        <nav className="tabs-scroll mt-6 flex gap-2 overflow-x-auto overflow-y-hidden border-b" aria-label={tEmployees('tabsLabel')}>
          {(['overview', 'personal', 'employments', 'reminders', 'documents', 'absence', ...(canReadPayslips ? ['payslips' as const] : []), ...(canReadNotes ? ['notes' as const] : [])] as const).map((item) => {
            const active = tab === item
            const label = item === 'overview' ? tEmployees('tabDashboard') : item === 'personal' ? tEmployees('tabPersonal') : item === 'employments' ? tEmployees('tabEmployments') : item === 'reminders' ? tEmployees('tabReminders') : item === 'documents' ? tEmployees('tabDocuments') : item === 'absence' ? tEmployees('absenceTab') : item === 'payslips' ? tDocuments('payslipsTab') : tEmployees('tabNotes')
            return <Link prefetch={false} key={item} href={`/employees/${employeeId}?tab=${item}&view=${compact ? 'compact' : 'expanded'}`} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}>{label}</Link>
          })}
        </nav>

        {tab === 'overview' && <EmployeeDashboard canManageEmployments={canManageEmployments} absence={absenceOverview} detail={detail} customFields={customFields} documents={dashboardDocuments} reminders={reminders} activity={dashboardActivity} canWriteActivity={canWriteActivity} initialLayout={dashboardLayout} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{
          title: tEmployees('dashboardTitle'), subtitle: tEmployees('dashboardSubtitle'), openDetails: tEmployees('dashboardOpenDetails'), edit: tEmployees('editPersonal'), personal: tEmployees('dashboardPersonal'), contact: tEmployees('contactTitle'),
          workContact: tEmployees('workContact'), privateContact: tEmployees('privateContact'), noContact: tEmployees('noContact'), address: tEmployees('currentAddress'), noAddress: tEmployees('noAddress'), birthDate: tEmployees('birthDate'),
          nationality: tEmployees('nationality'), birthPlace: tEmployees('birthPlace'), gender: tEmployees('gender'), notRecorded: tEmployees('notRecorded'), customFields: tCustomFields('employeeTitle'), customFieldsEmpty: tEmployees('dashboardCustomFieldsEmpty'),
          employment: tEmployees('dashboardEmployment'), employmentEmpty: tEmployees('dashboardEmploymentEmpty'), department: tEmployees('department'), jobTitle: tEmployees('jobTitle'), manager: tEmployees('manager'), hoursPerWeek: tEmployees('hoursPerWeek'), salary: tEmployees('salary'),
          salaryHidden: tEmployees('salaryRevealHelp'), salaryNotAvailable: tEmployees('dashboardSalaryNotAvailable'), salaryMonthly: tEmployees('salaryMonthlySuffix'), salaryHourly: tEmployees('salaryHourlySuffix'), salaryLoading: tEmployees('dashboardSalaryLoading'), salaryFailed: tEmployees('dashboardSalaryFailed'), leave: tEmployees('dashboardLeave'), leaveDescription: tEmployees('dashboardLeaveDescription'),
          absence: tEmployees('dashboardAbsence'), budgets: tEmployees('dashboardBudgets'), budgetsDescription: tEmployees('dashboardBudgetsDescription'), contracts: tEmployees('dashboardContracts'), contractsDescription: tEmployees('dashboardContractsDescription'),
          contractCount: tEmployees('dashboardContractCount'), employmentNumber: tEmployment('employmentNumber'), employmentPeriod: tEmployment('period'), employmentActive: tEmployment('active'), employmentFuture: tEmployment('future'), employmentEnded: tEmployment('ended'), employmentNoActive: tEmployment('dashboardNoActive'), employmentAdd: tEmployment('dashboardAddEmployment'), laborConditions: tEmployment('laborConditions'), workerType: tEmployment('workerType'), workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'), workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'), activity: tEmployees('dashboardActivity'), activityDescription: tEmployees('dashboardActivityDescription'), activityEmpty: tEmployees('dashboardActivityEmpty'), activityAdd: tEmployees('dashboardActivityAdd'), activityPlaceholder: tEmployees('dashboardActivityPlaceholder'), activitySave: tEmployees('dashboardActivitySave'), activitySaving: tEmployees('dashboardActivitySaving'), activityFailed: tEmployees('dashboardActivityFailed'), reminders: tEmployees('tabReminders'), remindersEmpty: tEmployees('remindersEmpty'), workflows: tEmployees('dashboardWorkflows'), workflowsDescription: tEmployees('dashboardWorkflowsDescription'),
          assets: tEmployees('dashboardAssets'), assetsDescription: tEmployees('dashboardAssetsDescription'), vehicles: tEmployees('dashboardVehicles'), vehiclesDescription: tEmployees('dashboardVehiclesDescription'), software: tEmployees('dashboardSoftware'), softwareDescription: tEmployees('dashboardSoftwareDescription'),
          education: tEmployees('dashboardEducation'), educationDescription: tEmployees('dashboardEducationDescription'), documents: tEmployees('tabDocuments'), documentsEmpty: tEmployees('dashboardDocumentsEmpty'), performance: tEmployees('dashboardPerformance'),
          performanceDescription: tEmployees('dashboardPerformanceDescription'), futureModule: tEmployees('dashboardFutureModule'), futureModuleDescription: tEmployees('dashboardFutureModuleDescription'), viewContracts: tEmployees('tabEmployments'), viewDocuments: tEmployees('tabDocuments'), viewReminders: tEmployees('tabReminders'), moveUp: tEmployees('dashboardMoveUp'), moveDown: tEmployees('dashboardMoveDown'), drag: tEmployees('dashboardDrag'), layoutSaving: tEmployees('dashboardLayoutSaving'), layoutSaved: tEmployees('dashboardLayoutSaved'), layoutFailed: tEmployees('dashboardLayoutFailed'), profileLinks: tEmployees('profileLinks'), noProfileLinks: tEmployees('noProfileLinks'), addProfileLink: tEmployees('addProfileLink'), linkLabel: tEmployees('linkLabel'), linkUrl: tEmployees('linkUrl'), saveLink: tEmployees('saveLink'), linkFailed: tEmployees('linkFailed'), absenceReport: tEmployees('absenceReport'), absenceStartDate: tEmployees('absenceStartDate'), absencePercentage: tEmployees('absencePercentage'), absenceExpectedRecovery: tEmployees('absenceExpectedRecovery'), absenceHasSafetyNet: tEmployees('absenceHasSafetyNet'), absenceWorkAccident: tEmployees('absenceWorkAccident'), absenceThirdPartyAccident: tEmployees('absenceThirdPartyAccident'), absenceUnknown: tEmployees('absenceUnknown'), absenceYes: tEmployees('absenceYes'), absenceNo: tEmployees('absenceNo'), absenceSubmit: tEmployees('absenceSubmit'), absenceRecover: tEmployees('absenceRecover'), absenceRecoveredOn: tEmployees('absenceRecoveredOn'), absenceSaveFailed: tEmployees('absenceSaveFailed'), absenceNowSick: tEmployees('absenceNowSick'), absenceNowNotSick: tEmployees('absenceNowNotSick'), absenceLastReport: tEmployees('absenceLastReport'), absenceNoHistory: tEmployees('absenceNoHistory'), absenceActiveSince: tEmployees('absenceActiveSince'), absenceRecoveryWindow: tEmployees('absenceRecoveryWindow'), absenceClose: tEmployees('absenceClose'), name: tEmployees('name'), age: tEmployees('age'), daysUntilBirthday: tEmployees('daysUntilBirthday'), workEmail: tEmployees('workEmail'), privateEmail: tEmployees('privateEmail'), workPhone: tEmployees('workPhone'), privatePhone: tEmployees('privatePhone'),
        }} />}

        {tab === 'absence' && <section className="mt-8 space-y-6"><header><p className="eyebrow text-primary">{tEmployees('absenceTab')}</p><h2 className="mt-1 text-2xl font-semibold">{tEmployees('dashboardAbsence')}</h2></header><AbsenceQuickForm employeeId={employeeId} employmentId={detail.employments[0]?.id} currentCase={absenceOverview} labels={{ report: tEmployees('absenceReport'), startDate: tEmployees('absenceStartDate'), percentage: tEmployees('absencePercentage'), expectedRecovery: tEmployees('absenceExpectedRecovery'), hasSafetyNet: tEmployees('absenceHasSafetyNet'), workAccident: tEmployees('absenceWorkAccident'), thirdPartyAccident: tEmployees('absenceThirdPartyAccident'), unknown: tEmployees('absenceUnknown'), yes: tEmployees('absenceYes'), no: tEmployees('absenceNo'), submit: tEmployees('absenceSubmit'), recover: tEmployees('absenceRecover'), recoveredOn: tEmployees('absenceRecoveredOn'), failed: tEmployees('absenceSaveFailed'), close: tEmployees('absenceClose') }} />{absenceCases.length > 0 && <div className="space-y-3">{absenceCases.map((item) => <article key={item.id} className="rounded-2xl border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.firstAbsenceOn}</h3><span className={`status-chip ${item.status === 'ACTIVE' ? 'bg-destructive-surface text-destructive' : 'bg-success-surface text-success'}`}>{item.status === 'ACTIVE' ? tEmployees('absenceNowSick') : tEmployees('absenceNowNotSick')}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.spells.length} ziekteperiode(n) · {item.spells[0]?.absencePercentage ?? 100}%</p></article>)}</div>}</section>}

        {tab === 'personal' && <>
        <EmployeePersonCard
          detail={detail}
          defaultCountryCode={detail.defaultCountryCode}
          customFields={customFields}
          roleAssignments={roleAssignments}
          locale={locale}
          dateFormat={preferences.dateFormat}
          labels={{
            tabs: { personal: tEmployees('tabPersonal'), addresses: tEmployees('tabAddresses'), bankAccounts: tEmployees('tabBankAccounts'), relations: tEmployees('tabRelations'), additionalInformation: tEmployees('tabAdditionalInformation') },
            additionalInformationTitle: tEmployees('additionalInformationTitle'),
            customFields: { title: tCustomFields('employeeTitle'), subtitle: tCustomFields('employeeSubtitle'), save: tCustomFields('save'), saving: tCustomFields('saving'), saved: tCustomFields('saved'), failed: tCustomFields('failed'), readOnly: tCustomFields('readOnly'), yes: tCustomFields('yes'), no: tCustomFields('no') },
            overviewTitle: tEmployees('overviewTitle'), contactTitle: tEmployees('contactTitle'), workContact: tEmployees('workContact'), privateContact: tEmployees('privateContact'),
            noContact: tEmployees('noContact'), currentAddress: tEmployees('currentAddress'), noAddress: tEmployees('noAddress'), primaryBank: tEmployees('primaryBank'),
            noBankAccount: tEmployees('noBankAccount'), emergencyContacts: tEmployees('emergencyContacts'), noEmergencyContact: tEmployees('noEmergencyContact'),
            employmentCount: tEmployees('employmentCount'), personalTitle: tEmployees('personalTitle'), editPersonal: tEmployees('editPersonal'),
            save: tEmployees('save'), saving: tEmployees('saving'), saved: tEmployees('saved'), cancel: tEmployees('cancel'), genericError: tErrors('generic'),
            employeeNumber: tEmployees('employeeNumber'), firstName: tEmployees('firstName'), birthNamePrefix: tEmployees('birthNamePrefix'), birthName: tEmployees('birthName'),
            nameUsage: tEmployees('nameUsage'), nameUsageBirth: tEmployees('nameUsageBirth'), nameUsagePartner: tEmployees('nameUsagePartner'),
            nameUsagePartnerBirth: tEmployees('nameUsagePartnerBirth'), nameUsageBirthPartner: tEmployees('nameUsageBirthPartner'), gender: tEmployees('gender'),
            genderMale: tEmployees('genderMale'), genderFemale: tEmployees('genderFemale'), genderOther: tEmployees('genderOther'), genderUndisclosed: tEmployees('genderUndisclosed'),
            birthDate: tEmployees('birthDate'), birthPlace: tEmployees('birthPlace'), birthCountry: tEmployees('birthCountry'), nationality: tEmployees('nationality'), countrySearch: tEmployees('countrySearch'), countryNoResults: tEmployees('countryNoResults'),
            preferredLanguage: tEmployees('preferredLanguage'), privateEmail: tEmployees('privateEmail'), privatePhone: tEmployees('privatePhone'),
            privateMobile: tEmployees('privateMobile'), workEmail: tEmployees('workEmail'), workPhone: tEmployees('workPhone'),
            workPhoneExtension: tEmployees('workPhoneExtension'), workMobile: tEmployees('workMobile'), bsnTitle: tEmployees('bsnTitle'),
            bsnProtected: tEmployees('bsnProtected'), revealBsn: tEmployees('revealBsn'), revealingBsn: tEmployees('revealingBsn'),
            bsnNotRecorded: tEmployees('bsnNotRecorded'), bsnAuditHelp: tEmployees('bsnAuditHelp'), addressesTitle: tEmployees('addressesTitle'),
             addressesEmpty: tEmployees('addressesEmpty'), addAddress: tEmployees('addAddress'), editResource: tEmployees('editResource'), deleteResource: tEmployees('deleteResource'), confirmDelete: tEmployees('confirmDelete'), cannotDeleteLastAddress: tEmployees('cannotDeleteLastAddress'), directReminderTitle: tEmployees('directReminderTitle'), directReminderHelp: tEmployees('directReminderHelp'), reminderHrAdmin: tEmployees('reminderHrAdmin'), reminderManager: tEmployees('reminderManager'), reminderEmployee: tEmployees('reminderEmployee'), country: tEmployees('country'), addressSearch: tEmployees('addressSearch'), addressSearchPlaceholder: tEmployees('addressSearchPlaceholder'), manualEntry: tEmployees('manualEntry'), searchNoResults: tEmployees('searchNoResults'), searchUnavailable: tEmployees('searchUnavailable'), searchLoading: tEmployees('searchLoading'), lookupByPostalCode: tEmployees('lookupByPostalCode'), lookup: tEmployees('lookup'), lookupHint: tEmployees('lookupHint'), lookupUnavailable: tEmployees('lookupUnavailable'), addressLine1: tEmployees('addressLine1'), addressLine2: tEmployees('addressLine2'), region: tEmployees('region'), current: tEmployees('current'), validFrom: tEmployees('validFrom'),
            validUntil: tEmployees('validUntil'), street: tEmployees('street'), houseNumber: tEmployees('houseNumber'), addition: tEmployees('addition'),
            postalCode: tEmployees('postalCode'), city: tEmployees('city'), province: tEmployees('province'), countryCode: tEmployees('countryCode'),
            saveAddress: tEmployees('saveAddress'), banksTitle: tEmployees('banksTitle'), banksEmpty: tEmployees('banksEmpty'), addBank: tEmployees('addBank'),
            primary: tEmployees('primary'), iban: tEmployees('iban'), bic: tEmployees('bic'), accountHolder: tEmployees('accountHolder'),
            description: tEmployees('description'), makePrimary: tEmployees('makePrimary'), saveBank: tEmployees('saveBank'), relationsTitle: tEmployees('relationsTitle'),
            relationsEmpty: tEmployees('relationsEmpty'), addRelation: tEmployees('addRelation'), relationType: tEmployees('relationType'),
            relationPartner: tEmployees('relationPartner'), relationChild: tEmployees('relationChild'), relationParent: tEmployees('relationParent'),
            relationSibling: tEmployees('relationSibling'), relationDoctor: tEmployees('relationDoctor'), relationDentist: tEmployees('relationDentist'),
            relationOther: tEmployees('relationOther'), emergencyContact: tEmployees('emergencyContact'), lastName: tEmployees('lastName'),
             mobile: tEmployees('mobile'), email: tEmployees('email'), notes: tEmployees('notes'), saveRelation: tEmployees('saveRelation'), notRecorded: tEmployees('notRecorded'),
             rolesTitle: tEmployees('rolesTitle'), rolesEmpty: tEmployees('rolesEmpty'), roleDepartment: tEmployees('roleDepartment'), roleTenantWide: tEmployees('roleTenantWide'), roleValidFrom: tEmployees('roleValidFrom'), roleValidUntil: tEmployees('roleValidUntil'),
          }}
        />

        </>}

        {tab === 'documents' && canReadDocuments && <EmployeeDocumentDossier employeeId={employeeId} documents={documents} options={documentOptions} canWrite={canWriteDocuments} canDelete={canDeleteDocuments} labels={{ title: tDocuments('title'), subtitle: tDocuments('subtitle'), upload: tDocuments('upload'), uploadAdvanced: tDocuments('uploadAdvanced'), file: tDocuments('file'), fileDropTitle: tDocuments('fileDropTitle'), fileDropHelp: tDocuments('fileDropHelp'), fileSelected: tDocuments('fileSelected'), fileReplace: tDocuments('fileReplace'), fileRemove: tDocuments('fileRemove'), fileRules: tDocuments('fileRules'), documentTitle: tDocuments('documentTitle'), description: tDocuments('description'), tags: tDocuments('tags'), noCloudTags: tDocuments('noCloudTags'), category: tDocuments('category'), customMetadata: tDocuments('customMetadata'), automaticValue: tDocuments('automaticValue'), requiredFields: tDocuments('requiredFields'), advancedSettings: tDocuments('advancedSettings'), visibleToTitle: tDocuments('visibleToTitle'), visibleToEmployee: tDocuments('visibleToEmployee'), visibleToRole: tDocuments('visibleToRole'), visibleToDepartment: tDocuments('visibleToDepartment'), visibilityDefault: tDocuments('visibilityDefault'), reminderTitle: tDocuments('reminderTitle'), expiresOn: tDocuments('expiresOn'), reminderAt: tDocuments('reminderAt'), reminderForEmployee: tDocuments('reminderForEmployee'), reminderForRole: tDocuments('reminderForRole'), save: tDocuments('save'), saving: tDocuments('saving'), failed: tDocuments('failed'), empty: tDocuments('empty'), download: tDocuments('download'), delete: tDocuments('delete'), restore: tDocuments('restore'), deleteReason: tDocuments('deleteReason'), deleted: tDocuments('deleted'), expires: tDocuments('expires'), reminderActive: tDocuments('reminderActive'), addedOn: tDocuments('addedOn'), employeeVisibilityAllowed: tDocuments('employeeVisibilityAllowed'), employeeVisibilityBlocked: tDocuments('employeeVisibilityBlocked'), additionalRoles: tDocuments('additionalRoles'), additionalDepartments: tDocuments('additionalDepartments'), noExtraVisibility: tDocuments('noExtraVisibility'), noReminderRecipients: tDocuments('noReminderRecipients'), invalidType: tDocuments('invalidType'), invalidSize: tDocuments('invalidSize'), invalidInput: tDocuments('invalidInput'), audienceRequired: tDocuments('audienceRequired'), expiryRequired: tDocuments('expiryRequired'), reminderTargetRequired: tDocuments('reminderTargetRequired'), singleFileOnly: tDocuments('singleFileOnly'), view: tDocuments('view'), viewerClose: tDocuments('viewerClose'), viewerUnsupported: tDocuments('viewerUnsupported') }} />}

        {tab === 'payslips' && canReadPayslips && <EmployeePayslips employeeId={employeeId} payslips={payslips} labels={{ title: tDocuments('payslipsTitle'), subtitle: tDocuments('payslipsSubtitle'), empty: tDocuments('payslipsEmpty'), view: tDocuments('view'), download: tDocuments('download'), close: tDocuments('viewerClose'), unsupported: tDocuments('viewerUnsupported'), source: tDocuments('payslipSource'), imported: tDocuments('payslipImported') }} />}

        {tab === 'reminders' && <EmployeeReminders employeeId={employeeId} reminders={reminders} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{ title: tEmployees('remindersTitle'), empty: tEmployees('remindersEmpty'), add: tEmployees('addReminder'), edit: tEmployees('editReminder'), remove: tEmployees('deleteReminder'), titleLabel: tEmployees('reminderTitle'), descriptionLabel: tEmployees('reminderDescription'), dateLabel: tEmployees('reminderDate'), save: tEmployees('saveReminder'), saved: tEmployees('reminderSaved'), failed: tErrors('generic'), cancel: tEmployees('cancel'), shiftDayBack: tEmployees('reminderDayBack'), shiftDayForward: tEmployees('reminderDayForward'), shiftWeekForward: tEmployees('reminderWeekForward'), shiftMonthForward: tEmployees('reminderMonthForward'), confirmDelete: tEmployees('confirmDelete') }} />}

        {tab === 'notes' && canReadNotes && <EmployeeNotes employeeId={employeeId} notes={notes} canWrite={canWriteNotes} canDelete={canDeleteNotes} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{ title: tEmployees('notesTitle'), accessNotice: tEmployees('notesAccessNotice'), empty: tEmployees('notesEmpty'), add: tEmployees('addNote'), edit: tEmployees('editNote'), remove: tEmployees('deleteNote'), noteTitle: tEmployees('noteTitle'), description: tEmployees('description'), author: tEmployees('noteAuthor'), createdAt: tEmployees('noteCreatedAt'), save: tEmployees('saveNote'), cancel: tEmployees('cancel'), saving: tEmployees('saving'), failed: tErrors('generic'), saved: tEmployees('noteSaved'), confirmDelete: tEmployees('confirmDelete') }} />}

        {tab === 'employments' && <div className="mt-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tEmployment('title')}</h2>
            </div>
            <EmploymentTimeline
              employments={detail.employments}
              summaries={detail.employmentCards}
              locale={locale}
              dateFormat={preferences.dateFormat}
              labels={{
                empty: tEmployment('empty'),
                active: tEmployment('active'),
                ended: tEmployment('ended'),
                future: tEmployment('future'),
                primary: tEmployment('primary'),
                employmentNumber: tEmployment('employmentNumber'),
                editDetail: tEmployment('editDetail'),
                status: tEmployment('status'),
                indefinite: tEmployment('indefinite'),
                definite: tEmployment('definite'),
                seniority: tEmployment('seniorityDate'), seniorityDuration: tEmployment('seniorityDuration'),
                department: tEmployment('department'), jobTitle: tEmployment('jobTitle'), hoursPerWeek: tEmployment('weeklyHours'),
                laborConditions: tEmployment('laborConditions'), workerType: tEmployment('workerType'),
                workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'),
                workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'),
                notRecorded: tEmployment('notRecorded'),
              }}
            />
          </section>
          {canManageEmployments && creationOptions && <div className="mt-6 flex justify-end">
            <EmploymentCreateModal
              employeeId={employeeId}
              options={creationOptions}
              initialOpen={create === '1'}
              labels={{
                title: tEmployment('new'),
                modalTitle: tEmployment('newWizardTitle'),
                cancel: tEmployment('cancel'),
                submit: tEmployment('create'), saved: tEmployment('created'), failed: tErrors('generic'),
                previous: tEmployment('previous'), next: tEmployment('next'),
                requiredFields: tEmployment('requiredFields'),
                employmentNumber: tEmployment('employmentNumber'), primaryEmployment: tEmployment('primaryEmployment'),
                yes: tEmployment('yes'), no: tEmployment('no'), startDate: tEmployment('startDate'),
                seniorityDate: tEmployment('seniorityDate'), country: tEmployment('country'),
                ikvNumber: tEmployment('incomeRelationshipNumber'), prerequisitesTitle: tEmployment('prerequisitesTitle'),
                nationality: tEmployment('nationality'), bsn: tEmployment('bsn'), birthDate: tEmployment('birthDate'),
                gender: tEmployment('gender'), employeeNumber: tEmployment('employeeNumber'),
                savePrerequisites: tEmployment('savePrerequisites'), prerequisiteSaved: tEmployment('prerequisiteSaved'),
                genderMale: tEmployment('genderMale'), genderFemale: tEmployment('genderFemale'),
                genderOther: tEmployment('genderOther'), genderUndisclosed: tEmployment('genderUndisclosed'),
                stepEmployment: tEmployment('stepEmployment'), stepContract: tEmployment('stepContract'),
                stepSchedule: tEmployment('stepSchedule'), stepSalary: tEmployment('stepSalary'),
                stepOther: tEmployment('stepOther'), stepReview: tEmployment('stepReview'),
                workerType: tEmployment('workerType'), workerEmployee: tEmployment('workerEmployee'),
                workerStudentIntern: tEmployment('workerStudentIntern'),
                workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'),
                flexPhase: tEmployment('flexPhase'), laborConditions: tEmployment('laborConditions'),
                duration: tEmployment('duration'), indefinite: tEmployment('indefinite'),
                definite: tEmployment('definite'), endDate: tEmployment('endsOn'),
                probation: tEmployment('probation'), probationEnd: tEmployment('probationEnd'),
                addFourWeeks: tEmployment('addFourWeeks'), addOneMonth: tEmployment('addOneMonth'),
                addTwoMonths: tEmployment('addTwoMonths'), onCallEmployee: tEmployment('onCallEmployee'),
                onCallObligation: tEmployment('onCallObligation'), employmentScope: tEmployment('employmentScope'),
                fullTime: tEmployment('fullTime'), partTime: tEmployment('partTime'),
                weeklyHours: tEmployment('weeklyHours'), partTimeFactor: tEmployment('partTimeFactor'),
                roster: tEmployment('roster'), rosterMismatch: tEmployment('rosterMismatch'),
                monday: tEmployment('monday'), tuesday: tEmployment('tuesday'),
                wednesday: tEmployment('wednesday'), thursday: tEmployment('thursday'),
                friday: tEmployment('friday'), saturday: tEmployment('saturday'), sunday: tEmployment('sunday'),
                salaryCalculation: tEmployment('salaryCalculation'), salaryManual: tEmployment('salaryManual'),
                salaryMinimum: tEmployment('salaryMinimum'), salaryTable: tEmployment('salaryTable'),
                frequency: tEmployment('frequency'), fulltimeSalary: tEmployment('fulltimeSalary'),
                parttimeSalary: tEmployment('parttimeSalary'), salaryScaleStep: tEmployment('salaryScaleStep'),
                minimumHourlyRate: tEmployment('minimumHourlyRate'),
                department: tEmployment('department'), job: tEmployment('job'),
                costCenter: tEmployment('costCenter'), costCarrier: tEmployment('costCarrier'),
                completeSummary: tEmployment('completeSummary'), createHint: tEmployment('createHint'),
              }}
            />
          </div>}
        </div>}
      </main>
  )
}
