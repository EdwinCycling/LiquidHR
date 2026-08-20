import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Mail, Maximize2, Minimize2, Phone } from 'lucide-react'
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { EmployeePersonCard } from '@/components/employees/employee-person-card'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'
import { Badge } from '@/components/ui/badge'
import { EmployeeDashboard } from '@/components/employees/employee-dashboard'
import { EmailLink } from '@/components/shared/email-link'
import { EmployeeArchiveToggle } from '@/components/employees/employee-archive-toggle'
import { EmployeeAvatarManager } from '@/components/employees/employee-avatar-manager'
import { EmployeeWeatherDrawer } from '@/components/employees/employee-weather-drawer'
import { EmploymentTimeline } from '@/components/employment/employment-timeline'
import { EmployeeDocumentDossier } from '@/components/documents/employee-document-dossier'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import {
  EmploymentServiceError,
  getEmployeeEmploymentDetail,
} from '@/lib/employment/employment-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import { DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT, getEmployeeDashboardLayout } from '@/lib/preferences/employee-dashboard'
import { createServerPerformanceTrace, type ServerPerformanceTrace } from '@/lib/performance/server-trace'
import { getEmployeeCustomFields } from '@/lib/custom-fields/service'
import { listEmployeeActivity } from '@/lib/employees/employee-activity-service'
import { getDocumentOptions, listEmployeeDashboardDocuments, listEmployeeDocuments } from '@/lib/documents/document-service'
import { listEmployeePayslips } from '@/lib/documents/payslip-service'
import { EmployeePayslips } from '@/components/documents/employee-payslips'
import { listEmployeeReminders } from '@/lib/reminders/reminder-service'
import { EmployeeReminders } from '@/components/employees/employee-reminders'
import { listEmployeeRoleAssignments } from '@/lib/organization/management-service'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { employeeNotesPermissionAllowed, listEmployeeNotes } from '@/lib/employees/employee-notes-service'
import { EmployeeNotes } from '@/components/employees/employee-notes'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { AbsenceCaseDetail } from '@/components/absence/absence-case-detail'
import { listEmployeeAbsence } from '@/lib/absence/service'
import { canEmployeeSelfReportAbsence } from '@/lib/absence/settings-service'
import { createClient } from '@/lib/supabase/server'
import { listProcessWork } from '@/lib/process-automation/work-service'
import { getUpcomingCalendarItems, type UpcomingCalendarItems } from '@/lib/company-activities/service'
import { getPrivateWeatherForEmployee, getWorkWeatherForContext } from '@/lib/weather/work-weather'
import { getEmployeeJourneyProjections } from '@/lib/journeys/projection-service'
import type { JourneyProjectionList } from '@/lib/journeys/projection-domain'

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ tab?: string; edit?: string; view?: string; caseId?: string; perf?: string }>
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface EmployeeDetailDependencies {
  supabase: SupabaseServerClient
  userId: string
  performance: ServerPerformanceTrace
}

async function loadPageData(employeeId: string, tab: 'overview' | 'personal' | 'employments' | 'reminders' | 'documents' | 'payslips' | 'notes' | 'absence' | 'processes', dependencies: EmployeeDetailDependencies) {
  try {
    const { performance } = dependencies
    const detailScope = tab === 'overview' || tab === 'processes' ? 'overview' : tab === 'personal' ? 'personal' : tab === 'employments' ? 'employments' : 'employments'
    const [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, canReadDashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity] = await performance.measure('initial.parallel', () => Promise.all([
      getEmployeeEmploymentDetail(employeeId, detailScope, { includeSalary: tab !== 'overview' && tab !== 'processes', supabase: dependencies.supabase }),
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
      tab === 'overview' ? getEmployeeDashboardLayout({ supabase: dependencies.supabase, userId: dependencies.userId }) : Promise.resolve(DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT),
      tab === 'overview' ? listEmployeeActivity(employeeId).catch(() => []) : Promise.resolve([]),
      tab === 'overview' ? permissionAllowed('employee-activity:write', employeeId) : Promise.resolve(false),
    ]))
    const [canReadDocuments, canWriteDocuments, canDeleteDocuments] = tab === 'documents'
      ? await performance.measure('documents.permissions', () => Promise.all([
        permissionAllowed('document:read', employeeId), permissionAllowed('document:write', employeeId), permissionAllowed('document:delete', employeeId),
      ]))
      : [false, false, false]
    const [documents, documentOptions] = tab === 'documents' ? await Promise.all([
      canReadDocuments ? listEmployeeDocuments(employeeId) : Promise.resolve([]),
      canWriteDocuments ? getDocumentOptions(employeeId) : Promise.resolve(null),
    ]) : [[], null]
    const canReadPayslips = tab === 'payslips' ? await permissionAllowed('payslip:read', employeeId) : false
    const payslips = tab === 'payslips' && canReadPayslips ? await listEmployeePayslips(employeeId) : []
    const [dashboardDocuments, absenceCases, selfReport, journeys, canReadNotes] = await performance.measure('overview.parallel', () => Promise.all([
      tab === 'overview' && canReadDashboardDocuments ? listEmployeeDashboardDocuments(employeeId) : Promise.resolve([]),
      tab === 'overview' || tab === 'absence' ? listEmployeeAbsence(employeeId).catch(() => []) : Promise.resolve([]),
      tab === 'overview' ? canEmployeeSelfReportAbsence(employeeId).catch(() => false) : Promise.resolve(false),
      tab === 'overview' ? getEmployeeJourneyProjections(employeeId).catch((): JourneyProjectionList => []) : Promise.resolve<JourneyProjectionList>([]),
      tab === 'notes' ? employeeNotesPermissionAllowed(employeeId) : Promise.resolve(false),
    ]))
    const base = [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases, selfReport, journeys] as const
    const [canWriteNotes, canDeleteNotes, notes] = canReadNotes
      ? await performance.measure('notes.parallel', () => Promise.all([
        permissionAllowed('employee-note:write', employeeId),
        permissionAllowed('employee-note:delete', employeeId),
        listEmployeeNotes(employeeId),
      ]))
      : [false, false, []]
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

function EmployeeCalendarHeader({ items, locale, labels }: { items: UpcomingCalendarItems; locale: string; labels: { holiday: string; activity: string } }) {
  if (!items.holiday && !items.companyActivity) return null
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const formatItem = (template: string, item: { name: string; date: string }) => template.replace('{name}', item.name).replace('{date}', new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`)))
  return <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border-subtle pt-4 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{items.holiday ? <span>{formatItem(labels.holiday, items.holiday)}</span> : null}{items.companyActivity ? <span>{formatItem(labels.activity, items.companyActivity)}</span> : null}</div>
}

export default async function EmployeeDetailPage({ params, searchParams }: EmployeeDetailPageProps) {
  const { employeeId } = await params
  const { tab: requestedTab, edit, view, caseId, perf } = await searchParams
  const performanceTrace = createServerPerformanceTrace('/employees/[employeeId]', perf === '1')
  const requestContext = await performanceTrace.measure('auth.context', getRequestAuthorizationContext)
  const authContext = requestContext.context
  if (authContext.employeeId !== employeeId && !authContext.permissions.includes('employee:read')) redirect('/employees')
  if (authContext.employeeId !== employeeId && authContext.activeRoles.includes('DIRECT_MANAGER') && !authContext.activeRoles.includes('TENANT_ADMIN')) {
    const directTeamEmployeeIds = await performanceTrace.measure('auth.teamScope', () => listDirectTeamEmployeeIds(authContext, requestContext.supabase))
    if (!directTeamEmployeeIds.includes(employeeId)) redirect('/employees')
  }
  const canReadProcesses = authContext.permissions.includes('process-instance:read') || (authContext.permissions.includes('self:process-instance:read') && authContext.employeeId === employeeId)
  const tab = requestedTab === 'overview' || requestedTab === 'employments' || requestedTab === 'documents' || requestedTab === 'payslips' || requestedTab === 'reminders' || requestedTab === 'personal' || requestedTab === 'notes' || requestedTab === 'absence' || (requestedTab === 'processes' && canReadProcesses) ? requestedTab : 'overview'
  const [pageData, workWeather, privateWeather, calendarHeader] = await performanceTrace.measure('page.data', () => Promise.all([
    loadPageData(employeeId, tab, {
      supabase: requestContext.supabase,
      userId: authContext.userId,
      performance: performanceTrace,
    }),
    getWorkWeatherForContext(authContext, requestContext.supabase),
    getPrivateWeatherForEmployee(authContext, employeeId, requestContext.supabase),
    getUpcomingCalendarItems(authContext, requestContext.supabase),
  ]))
  const [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases, selfReport, journeys, notes, canReadNotes, canWriteNotes, canDeleteNotes] = pageData
  performanceTrace.finish()
  const tProcess = await getTranslator('processAutomation', locale)
  const tWeather = await getTranslator('startpage', locale)
  const weatherLabels = { weatherTitle: tWeather('weatherTitle'), weatherOpen: tWeather('weatherOpen'), weatherClose: tWeather('weatherClose'), weatherUnavailable: tWeather('weatherUnavailable'), weatherTodayMax: tWeather('weatherTodayMax'), weatherPressureUp: tWeather('weatherPressureUp'), weatherPressureDown: tWeather('weatherPressureDown'), weatherPressureSteady: tWeather('weatherPressureSteady'), weatherHumidity: tWeather('weatherHumidity'), weatherWind: tWeather('weatherWind'), weatherPressure: tWeather('weatherPressure'), weatherLocationToggle: tWeather('weatherLocationToggle'), weatherWork: tWeather('weatherWork'), weatherHome: tWeather('weatherHome') }
  const canStartProcess = authContext.permissions.includes('process-instance:start') || (authContext.permissions.includes('self:process-instance:start') && authContext.employeeId === employeeId)
  const processWork = (tab === 'overview' || tab === 'processes') && canReadProcesses
    ? await listProcessWork({ subjectEmployeeId: employeeId, tab: 'ALL', language: locale }).catch(() => null)
    : null
  const compact = view === 'compact'
  const absenceOverview = absenceCases.find((item) => item.status === 'ACTIVE') ?? absenceCases.find((item) => item.status !== 'CLOSED') ?? absenceCases[0] ?? null
  const selectedAbsenceCase = tab === 'absence' && caseId ? absenceCases.find((item) => item.id === caseId) ?? null : null
  const statusLabel = {
    ACTIVE_EMPLOYEE: tEmployment('active'), FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'), NEVER_EMPLOYED: tEmployees('external'),
  }[detail.status]
  const processStatusLabel = (status: string) => ({
    OPEN: tProcess('statusOpen'), CLAIMED: tProcess('statusClaimed'), BLOCKED: tProcess('statusBlocked'), COMPLETED: tProcess('statusCompleted'), CANCELLED: tProcess('statusCancelled'), EXPIRED: tProcess('statusExpired'),
  }[status] ?? tProcess('unknown'))

  return (
      <PageShell width="standard" className="py-7 lg:py-10">
        <Link href="/employees" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployees('title')}
        </Link>
        <Surface className={`relative mt-5 overflow-hidden ${compact ? 'p-2.5 sm:px-4' : 'px-5 py-6 sm:px-8 sm:py-8'}`}>
          {compact ? <><div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EmployeeAvatarManager compact employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} gender={detail.employee.gender} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed') }} />
              <h1 className="truncate text-base font-semibold tracking-tight">{detail.employee.firstName} {detail.employee.birthName}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2"><EmployeeWeatherDrawer homeWeather={privateWeather} labels={weatherLabels} weather={workWeather} /><Link aria-label={tEmployees('expand')} href={`/employees/${employeeId}?tab=${tab}&view=expanded`} prefetch={false} title={tEmployees('expand')} className="inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-subtle bg-surface-subtle text-foreground transition-colors hover:bg-muted"><Maximize2 aria-hidden="true" size={18} /></Link></div>
          </div><EmployeeCalendarHeader items={calendarHeader} locale={locale} labels={{ holiday: tEmployees('nextHoliday'), activity: tEmployees('nextCompanyActivity') }} /></> : <>
            <div className="relative grid gap-x-8 gap-y-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
              <EmployeeAvatarManager employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} gender={detail.employee.gender} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed') }} />
              <div className="min-w-0 self-center text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <p className="eyebrow text-muted-foreground">{detail.employee.employeeNumber}</p>
                  {detail.employee.isArchived && <Badge tone="warning">{tEmployees('archived')}</Badge>}
                  <Badge tone={detail.employee.isActive ? 'success' : 'info'}>{statusLabel}</Badge>
                </div>
                <h1 className="mt-2 break-words text-4xl font-semibold leading-none tracking-[-0.04em] sm:text-5xl md:text-4xl xl:text-5xl">{detail.employee.firstName} {detail.employee.birthName}</h1>
              </div>
              <div className="flex flex-col items-center gap-3 md:self-stretch md:items-end md:justify-between">
                <div className="flex items-center gap-2"><EmployeeWeatherDrawer homeWeather={privateWeather} labels={weatherLabels} weather={workWeather} /><Link aria-label={tEmployees('compact')} href={`/employees/${employeeId}?tab=${tab}&view=compact`} prefetch={false} title={tEmployees('compact')} className="inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-subtle bg-surface-subtle text-foreground transition-colors hover:bg-muted"><Minimize2 aria-hidden="true" size={18} /></Link></div>
                <EmployeeArchiveToggle headerStyle employeeId={employeeId} archived={detail.employee.isArchived} hasActiveEmployment={detail.employments.some((employment) => employment.record_status === 'CONFIRMED')} labels={{ archive: tEmployees('archiveEmployee'), unarchive: tEmployees('unarchiveEmployee'), archiveTitle: tEmployees('archiveConfirmTitle'), unarchiveTitle: tEmployees('unarchiveConfirmTitle'), archiveBody: tEmployees('archiveConfirmBody'), archiveAction: tEmployees('archiveConfirmAction'), cancel: tEmployees('archiveCancel'), saved: tEmployees('archiveSaved'), failed: tEmployees('archiveFailed'), notFound: tEmployees('archiveNotFound'), hasActiveEmployment: tEmployees('hasActiveEmployment') }} />
              </div>
            </div>
            <div className="relative mt-7 grid gap-3 border-t border-subtle pt-5 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="flex min-w-0 items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{(detail.employee.workEmail ?? detail.employee.privateEmail) ? <EmailLink className="text-primary hover:underline" email={detail.employee.workEmail ?? detail.employee.privateEmail ?? ''} /> : tEmployees('noEmail')}</span></span>
              {(detail.employee.workPhone ?? detail.employee.workMobile) && <a className="flex items-center gap-2 hover:text-foreground" href={`tel:${detail.employee.workPhone ?? detail.employee.workMobile}`}><Phone aria-hidden="true" className="h-4 w-4 shrink-0" />{detail.employee.workPhone ?? detail.employee.workMobile}</a>}
              <span className="flex items-center gap-2 sm:col-span-2 lg:col-span-1"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4 shrink-0" />{tEmployees('employmentCount', { count: detail.employments.length })}</span>
            </div>
            <EmployeeCalendarHeader items={calendarHeader} locale={locale} labels={{ holiday: tEmployees('nextHoliday'), activity: tEmployees('nextCompanyActivity') }} />
          </>}
        </Surface>

        <nav className="tabs-scroll mt-6 flex gap-2 overflow-x-auto overflow-y-hidden border-b" aria-label={tEmployees('tabsLabel')}>
          {(['overview', 'personal', 'employments', 'reminders', 'documents', 'absence', ...(canReadProcesses ? ['processes' as const] : []), ...(canReadPayslips ? ['payslips' as const] : []), ...(canReadNotes ? ['notes' as const] : [])] as const).map((item) => {
            const active = tab === item
            const label = item === 'overview' ? tEmployees('tabDashboard') : item === 'personal' ? tEmployees('tabPersonal') : item === 'employments' ? tEmployees('tabEmployments') : item === 'reminders' ? tEmployees('tabReminders') : item === 'documents' ? tEmployees('tabDocuments') : item === 'absence' ? tEmployees('absenceTab') : item === 'processes' ? tProcess('processesTab') : item === 'payslips' ? tDocuments('payslipsTab') : tEmployees('tabNotes')
            return <Link prefetch={false} key={item} href={`/employees/${employeeId}?tab=${item}&view=${compact ? 'compact' : 'expanded'}`} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}>{label}</Link>
          })}
        </nav>

        {tab === 'overview' && <EmployeeDashboard journeys={journeys} journeyLabels={{ journeys: tEmployees('journeys'), journeysDescription: tEmployees('journeysDescription'), journeysEmpty: tEmployees('journeysEmpty'), journeysOpen: tEmployees('journeysOpen'), journeyProgress: tEmployees('journeyProgress') }} selfReportAbsence={selfReport} canManageEmployments={canManageEmployments} absence={absenceOverview} detail={detail} customFields={customFields} documents={dashboardDocuments} reminders={reminders} activity={dashboardActivity} canWriteActivity={canWriteActivity} initialLayout={dashboardLayout} compact={compact} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} processWork={processWork} canReadProcesses={canReadProcesses} canStartProcess={canStartProcess} labels={{
          title: tEmployees('dashboardTitle'), subtitle: tEmployees('dashboardSubtitle'), openDetails: tEmployees('dashboardOpenDetails'), edit: tEmployees('editPersonal'), personal: tEmployees('dashboardPersonal'), contact: tEmployees('contactTitle'),
          workContact: tEmployees('workContact'), privateContact: tEmployees('privateContact'), noContact: tEmployees('noContact'), address: tEmployees('currentAddress'), noAddress: tEmployees('noAddress'), birthDate: tEmployees('birthDate'),
          nationality: tEmployees('nationality'), birthPlace: tEmployees('birthPlace'), gender: tEmployees('gender'), notRecorded: tEmployees('notRecorded'), customFields: tCustomFields('employeeTitle'), customFieldsEmpty: tEmployees('dashboardCustomFieldsEmpty'),
          employment: tEmployees('dashboardEmployment'), employmentEmpty: tEmployees('dashboardEmploymentEmpty'), department: tEmployees('department'), jobTitle: tEmployees('jobTitle'), manager: tEmployees('manager'), hoursPerWeek: tEmployees('hoursPerWeek'), salary: tEmployees('salary'),
          salaryHidden: tEmployees('salaryRevealHelp'), salaryNotAvailable: tEmployees('dashboardSalaryNotAvailable'), salaryMonthly: tEmployees('salaryMonthlySuffix'), salaryHourly: tEmployees('salaryHourlySuffix'), salaryLoading: tEmployees('dashboardSalaryLoading'), salaryFailed: tEmployees('dashboardSalaryFailed'), leave: tEmployees('dashboardLeave'), leaveDescription: tEmployees('dashboardLeaveDescription'),
          absence: tEmployees('dashboardAbsence'), budgets: tEmployees('dashboardBudgets'), budgetsDescription: tEmployees('dashboardBudgetsDescription'), contracts: tEmployees('dashboardContracts'), contractsDescription: tEmployees('dashboardContractsDescription'),
          contractCount: tEmployees('dashboardContractCount'), employmentNumber: tEmployment('employmentNumber'), employmentPeriod: tEmployment('period'), employmentActive: tEmployment('active'), employmentFuture: tEmployment('future'), employmentEnded: tEmployment('ended'), employmentNoActive: tEmployment('dashboardNoActive'), employmentAdd: tEmployment('dashboardAddEmployment'), laborConditions: tEmployment('laborConditions'), workerType: tEmployment('workerType'), workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'), workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'), workerFreelancer: tEmployment('workerFreelancer'), workerVolunteer: tEmployment('workerVolunteer'), workerNoPayroll: tEmployment('workerNoPayroll'), activity: tEmployees('dashboardActivity'), activityDescription: tEmployees('dashboardActivityDescription'), activityEmpty: tEmployees('dashboardActivityEmpty'), activityAdd: tEmployees('dashboardActivityAdd'), activityPlaceholder: tEmployees('dashboardActivityPlaceholder'), activitySave: tEmployees('dashboardActivitySave'), activitySaving: tEmployees('dashboardActivitySaving'), activityFailed: tEmployees('dashboardActivityFailed'), reminders: tEmployees('tabReminders'), remindersEmpty: tEmployees('remindersEmpty'), workflows: tEmployees('dashboardWorkflows'), workflowsDescription: tEmployees('dashboardWorkflowsDescription'), workflowsOpen: tEmployees('dashboardWorkflowsOpen'), workflowsEmpty: tEmployees('dashboardWorkflowsEmpty'), workflowsUnavailable: tEmployees('dashboardWorkflowsUnavailable'), workflowsBlocked: tEmployees('dashboardWorkflowsBlocked'), workflowsOverdue: tEmployees('dashboardWorkflowsOverdue'), workflowsStart: tEmployees('dashboardWorkflowsStart'),
          assets: tEmployees('dashboardAssets'), assetsDescription: tEmployees('dashboardAssetsDescription'), vehicles: tEmployees('dashboardVehicles'), vehiclesDescription: tEmployees('dashboardVehiclesDescription'), software: tEmployees('dashboardSoftware'), softwareDescription: tEmployees('dashboardSoftwareDescription'),
          education: tEmployees('dashboardEducation'), educationDescription: tEmployees('dashboardEducationDescription'), documents: tEmployees('tabDocuments'), documentsEmpty: tEmployees('dashboardDocumentsEmpty'), performance: tEmployees('dashboardPerformance'),
          performanceDescription: tEmployees('dashboardPerformanceDescription'), futureModule: tEmployees('dashboardFutureModule'), futureModuleDescription: tEmployees('dashboardFutureModuleDescription'), viewContracts: tEmployees('tabEmployments'), viewDocuments: tEmployees('tabDocuments'), viewReminders: tEmployees('tabReminders'), moveUp: tEmployees('dashboardMoveUp'), moveDown: tEmployees('dashboardMoveDown'), drag: tEmployees('dashboardDrag'), layoutSaving: tEmployees('dashboardLayoutSaving'), layoutSaved: tEmployees('dashboardLayoutSaved'), layoutFailed: tEmployees('dashboardLayoutFailed'), profileLinks: tEmployees('profileLinks'), noProfileLinks: tEmployees('noProfileLinks'), addProfileLink: tEmployees('addProfileLink'), linkLabel: tEmployees('linkLabel'), linkUrl: tEmployees('linkUrl'), saveLink: tEmployees('saveLink'), linkFailed: tEmployees('linkFailed'), absenceReport: tEmployees('absenceReport'), absenceStartDate: tEmployees('absenceStartDate'), absencePercentage: tEmployees('absencePercentage'), absenceExpectedRecovery: tEmployees('absenceExpectedRecovery'), absenceHasSafetyNet: tEmployees('absenceHasSafetyNet'), absenceWorkAccident: tEmployees('absenceWorkAccident'), absenceThirdPartyAccident: tEmployees('absenceThirdPartyAccident'), absenceUnknown: tEmployees('absenceUnknown'), absenceYes: tEmployees('absenceYes'), absenceNo: tEmployees('absenceNo'), absenceSubmit: tEmployees('absenceSubmit'), absenceRecover: tEmployees('absenceRecover'), absenceRecoveredOn: tEmployees('absenceRecoveredOn'), absenceSaveFailed: tEmployees('absenceSaveFailed'), absenceNowSick: tEmployees('absenceNowSick'), absenceNowNotSick: tEmployees('absenceNowNotSick'), absenceLastReport: tEmployees('absenceLastReport'), absenceNoHistory: tEmployees('absenceNoHistory'), absenceActiveSince: tEmployees('absenceActiveSince'), absenceRecoveryWindow: tEmployees('absenceRecoveryWindow'), absenceOpenCase: tEmployees('absenceOpenCase'), absenceClose: tEmployees('absenceClose'), name: tEmployees('name'), age: tEmployees('age'), daysUntilBirthday: tEmployees('daysUntilBirthday'), workEmail: tEmployees('workEmail'), privateEmail: tEmployees('privateEmail'), workPhone: tEmployees('workPhone'), privatePhone: tEmployees('privatePhone'),
        }} />}

        {tab === 'processes' && <section className="mt-8 space-y-5"><header><p className="eyebrow text-primary">{tProcess('processesTab')}</p><h2 className="mt-1 text-2xl font-semibold">{tProcess('workspaceTitle')}</h2><p className="mt-2 text-sm text-muted-foreground">{tProcess('workspaceDescription')}</p></header>{!processWork ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{tProcess('readError')}</p> : processWork.items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground" role="status">{tProcess('noItems')}</p> : <div className="grid gap-4">{processWork.items.map((item) => <article className="rounded-2xl border border-border bg-surface p-5" key={item.workItemId}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{item.processKey}</p><h3 className="mt-1 font-semibold">{item.processTitle}</h3></div><span className="status-chip bg-muted text-muted-foreground">{processStatusLabel(item.status)}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">{tProcess('step')}</dt><dd className="mt-1">{item.stepTitle}</dd></div><div><dt className="text-xs text-muted-foreground">{tProcess('subject')}</dt><dd className="mt-1">{item.subjectName ?? tProcess('unknown')}</dd></div><div><dt className="text-xs text-muted-foreground">{tProcess('deadline')}</dt><dd className="mt-1">{item.deadlineAt ?? tProcess('unknown')}</dd></div></dl><Link prefetch={false} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/work/${item.workItemId}`}>{tProcess('open')}</Link></article>)}</div>}</section>}

        {tab === 'absence' && (selectedAbsenceCase ? <section className="mt-8"><AbsenceCaseDetail employeeId={employeeId} employmentId={detail.employments[0]?.id} compact={compact} absenceCase={selectedAbsenceCase} locale={locale} dateFormat={preferences.dateFormat} labels={{ title: tEmployees('absenceCaseDetail'), dossier: tEmployees('absenceCaseDossier'), heading: tEmployees('absenceCaseHeading'), back: tEmployees('absenceCaseBack'), status: tEmployees('absenceCaseStatus'), firstAbsence: tEmployees('absenceCaseFirstAbsence'), effectiveClockStart: tEmployees('absenceCaseEffectiveClockStart'), recoveryWindowEnds: tEmployees('absenceCaseRecoveryWindowEnds'), closedAt: tEmployees('absenceCaseClosedAt'), periods: tEmployees('absenceCasePeriods'), reportedAt: tEmployees('absenceCaseReportedAt'), expectedRecovery: tEmployees('absenceCaseExpectedRecovery'), recoveredOn: tEmployees('absenceCaseRecoveredOn'), capacity: tEmployees('absenceCaseCapacity'), capacityEffectiveOn: tEmployees('absenceCaseCapacityEffectiveOn'), nextReview: tEmployees('absenceCaseNextReview'), safetyNet: tEmployees('absenceHasSafetyNet'), workAccident: tEmployees('absenceWorkAccident'), thirdPartyAccident: tEmployees('absenceThirdPartyAccident'), frequentAbsence: tEmployees('absenceFrequent'), priorCases: tEmployees('absenceCasePriorCases'), threshold: tEmployees('absenceCaseThreshold'), noValue: tEmployees('absenceCaseNoValue'), yes: tEmployees('absenceYes'), no: tEmployees('absenceNo'), unknown: tEmployees('absenceUnknown'), nowSick: tEmployees('absenceNowSick'), nowNotSick: tEmployees('absenceNowNotSick'), recoveryWindow: tEmployees('absenceRecoveryWindow'), report: tEmployees('absenceReport'), startDate: tEmployees('absenceStartDate'), percentage: tEmployees('absencePercentage'), expectedRecoveryInput: tEmployees('absenceExpectedRecovery'), submit: tEmployees('absenceSubmit'), better: tEmployees('absenceRecover'), saveFailed: tEmployees('absenceSaveFailed'), close: tEmployees('absenceClose') }} /></section> : <section className="mt-8 space-y-6"><header><p className="eyebrow text-primary">{tEmployees('absenceTab')}</p><h2 className="mt-1 text-2xl font-semibold">{tEmployees('dashboardAbsence')}</h2></header><AbsenceQuickForm employeeId={employeeId} employmentId={detail.employments[0]?.id} currentCase={absenceOverview} recoveryMode="hidden" showReportAction={!absenceOverview || absenceOverview.status === 'CLOSED'} labels={{ report: tEmployees('absenceReport'), startDate: tEmployees('absenceStartDate'), percentage: tEmployees('absencePercentage'), expectedRecovery: tEmployees('absenceExpectedRecovery'), hasSafetyNet: tEmployees('absenceHasSafetyNet'), workAccident: tEmployees('absenceWorkAccident'), thirdPartyAccident: tEmployees('absenceThirdPartyAccident'), unknown: tEmployees('absenceUnknown'), yes: tEmployees('absenceYes'), no: tEmployees('absenceNo'), submit: tEmployees('absenceSubmit'), recover: tEmployees('absenceRecover'), recoveredOn: tEmployees('absenceRecoveredOn'), failed: tEmployees('absenceSaveFailed'), close: tEmployees('absenceClose') }} />{absenceCases.length > 0 ? <div className="space-y-3">{absenceCases.map((item) => <Link prefetch={false} key={item.id} href={`/employees/${employeeId}?tab=absence&view=${compact ? 'compact' : 'expanded'}&caseId=${item.id}`} className="group block rounded-2xl border bg-surface p-5 transition-colors hover:border-primary/45 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.firstAbsenceOn}</h3><span className={`status-chip ${item.status === 'ACTIVE' ? 'bg-destructive-surface text-destructive' : item.status === 'RECOVERY_WINDOW' ? 'bg-accent text-accent-foreground' : 'bg-success-surface text-success'}`}>{item.status === 'ACTIVE' ? tEmployees('absenceNowSick') : item.status === 'RECOVERY_WINDOW' ? tEmployees('absenceRecoveryWindow', { date: item.recoveryWindowEndsOn ?? '' }) : tEmployees('absenceNowNotSick')}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.spells.length} {tEmployees('absenceCasePeriods').toLowerCase()} · {item.spells[0]?.absencePercentage ?? 100}%</p><span className="mt-4 inline-flex text-sm font-semibold text-primary">{tEmployees('absenceCaseOpen')}</span></Link>)}</div> : <p className="rounded-xl border border-dashed border-primary/25 bg-accent/20 p-4 text-sm text-muted-foreground">{tEmployees('absenceEmpty')}</p>}</section>)}

        {tab === 'personal' && <>
        <EmployeePersonCard
          detail={detail}
          initialEdit={edit === '1'}
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
            preferredLanguage: tEmployees('preferredLanguage'), languageSearch: tEmployees('languageSearch'), languageNoResults: tEmployees('languageNoResults'), privateEmail: tEmployees('privateEmail'), privatePhone: tEmployees('privatePhone'),
            privateMobile: tEmployees('privateMobile'), workEmail: tEmployees('workEmail'), workPhone: tEmployees('workPhone'),
            workPhoneExtension: tEmployees('workPhoneExtension'), workMobile: tEmployees('workMobile'), bsnTitle: tEmployees('bsnTitle'),
            bsnProtected: tEmployees('bsnProtected'), revealBsn: tEmployees('revealBsn'), revealingBsn: tEmployees('revealingBsn'),
            bsnNotRecorded: tEmployees('bsnNotRecorded'), bsnAuditHelp: tEmployees('bsnAuditHelp'), addressesTitle: tEmployees('addressesTitle'), primaryAddress: tEmployees('primaryAddress'), secondaryAddress: tEmployees('secondaryAddress'), secondaryAddressDescription: tEmployees('secondaryAddressDescription'), secondaryAddressHelp: tEmployees('secondaryAddressHelp'), noSecondaryAddress: tEmployees('noSecondaryAddress'),
             addressesEmpty: tEmployees('addressesEmpty'), relocateAddress: tEmployees('relocateAddress'), addAddress: tEmployees('addAddress'), editResource: tEmployees('editResource'), deleteResource: tEmployees('deleteResource'), confirmDelete: tEmployees('confirmDelete'), cannotDeleteLastAddress: tEmployees('cannotDeleteLastAddress'), directReminderTitle: tEmployees('directReminderTitle'), directReminderHelp: tEmployees('directReminderHelp'), reminderHrAdmin: tEmployees('reminderHrAdmin'), reminderManager: tEmployees('reminderManager'), reminderEmployee: tEmployees('reminderEmployee'), country: tEmployees('country'), addressSearch: tEmployees('addressSearch'), addressSearchPlaceholder: tEmployees('addressSearchPlaceholder'), manualEntry: tEmployees('manualEntry'), searchNoResults: tEmployees('searchNoResults'), searchUnavailable: tEmployees('searchUnavailable'), searchLoading: tEmployees('searchLoading'), lookupByPostalCode: tEmployees('lookupByPostalCode'), lookup: tEmployees('lookup'), lookupHint: tEmployees('lookupHint'), lookupUnavailable: tEmployees('lookupUnavailable'), addressLine1: tEmployees('addressLine1'), addressLine2: tEmployees('addressLine2'), region: tEmployees('region'), current: tEmployees('current'), validFrom: tEmployees('validFrom'),
            validUntil: tEmployees('validUntil'), clearValidUntil: tEmployees('clearValidUntil'), street: tEmployees('street'), streetHasNumberNote: tEmployees('streetHasNumberNote'), houseNumber: tEmployees('houseNumber'), addition: tEmployees('addition'),
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

        {tab === 'reminders' && <EmployeeReminders employeeId={employeeId} mode={authContext.employeeId === employeeId ? 'PERSONAL' : 'HR'} canManageHr={authContext.permissions.includes('reminder:write')} reminders={reminders} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{ title: tEmployees('remindersTitle'), empty: tEmployees('remindersEmpty'), add: tEmployees('addReminder'), edit: tEmployees('editReminder'), remove: tEmployees('deleteReminder'), titleLabel: tEmployees('reminderTitle'), descriptionLabel: tEmployees('reminderDescription'), dateLabel: tEmployees('reminderDate'), save: tEmployees('saveReminder'), saved: tEmployees('reminderSaved'), failed: tErrors('generic'), cancel: tEmployees('cancel'), shiftDayBack: tEmployees('reminderDayBack'), shiftDayForward: tEmployees('reminderDayForward'), shiftWeekForward: tEmployees('reminderWeekForward'), shiftMonthForward: tEmployees('reminderMonthForward'), confirmDelete: tEmployees('confirmDelete') }} />}

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
                contractDetails: tEmployment('contractDetails'),
                contractType: tEmployment('contractType'),
                indefinite: tEmployment('indefinite'),
                definite: tEmployment('definite'),
                temporaryWithoutEnd: tEmployment('temporaryWithoutEnd'),
                 seniority: tEmployment('seniorityDate'), seniorityDuration: tEmployment('seniorityDuration'),
                 administration: tEmployment('administration'),
                 department: tEmployment('department'), jobTitle: tEmployment('jobTitle'), hoursPerWeek: tEmployment('weeklyHours'),
                laborConditions: tEmployment('laborConditions'), workerType: tEmployment('workerType'),
                workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'),
                workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'), workerFreelancer: tEmployment('workerFreelancer'), workerVolunteer: tEmployment('workerVolunteer'), workerNoPayroll: tEmployment('workerNoPayroll'),
                hoursPerWeekSuffix: tEmployment('hoursPerWeek'),
                noActiveContract: tEmployment('noActiveContract'),
                notRecorded: tEmployment('notRecorded'),
              }}
            />
          </section>
          {canManageEmployments && <div className="mt-6 flex justify-end">
            <Link href={`/employees/${employeeId}/employments/new`} className="button-primary">{tEmployment('new')}</Link>
          </div>}
        </div>}
      </PageShell>
  )
}
