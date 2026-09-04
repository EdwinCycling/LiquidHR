import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Mail, Maximize2, Minimize2, Phone } from 'lucide-react'
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { EmployeePersonCard } from '@/components/employees/employee-person-card'
import { PageShell } from '@/components/layout/page-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { ScrollableTabs } from '@/components/patterns/scrollable-tabs'
import { tabLinkClasses } from '@/components/patterns/tab-link-classes'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { EmployeeDashboard } from '@/components/employees/employee-dashboard'
import { EmailLink } from '@/components/shared/email-link'
import { EmployeeArchiveToggle } from '@/components/employees/employee-archive-toggle'
import { EmployeeAvatarManager } from '@/components/employees/employee-avatar-manager'
import { EmployeeWeatherDrawer } from '@/components/employees/employee-weather-drawer'
import { EmploymentTimeline } from '@/components/employment/employment-timeline'
import { NewEmploymentButton } from '@/components/employment/new-employment-button'
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
import { hasActiveEmployment } from '@/lib/employment/employment-card-state'
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
import { isAiImproveAvailable } from '@/lib/ai/supabase-governance'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { AbsenceCaseDetail } from '@/components/absence/absence-case-detail'
import { AbsenceCaseList } from '@/components/absence/absence-case-list'
import { listEmployeeAbsence, listEmployeeAbsenceEmploymentOptions } from '@/lib/absence/service'
import { getReportableAbsenceEmploymentOptions } from '@/components/absence/absence-presentational'
import { canEmployeeSelfReportAbsence } from '@/lib/absence/settings-service'
import { createClient } from '@/lib/supabase/server'
import { listProcessWork } from '@/lib/process-automation/work-service'
import { getUpcomingCalendarItems, type UpcomingCalendarItems } from '@/lib/company-activities/service'
import { getPrivateWeatherForEmployee, getWorkWeatherForContext } from '@/lib/weather/work-weather'
import { getEmployeeJourneyProjections } from '@/lib/journeys/projection-service'
import type { JourneyProjectionList } from '@/lib/journeys/projection-domain'
import { normalizeInsightReturnPath } from '@/lib/insights/query-seam'

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ tab?: string; edit?: string; view?: string; caseId?: string; perf?: string; from?: string; returnTo?: string }>
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
      tab === 'overview' || tab === 'absence' ? canEmployeeSelfReportAbsence(employeeId).catch(() => false) : Promise.resolve(false),
      tab === 'overview' ? getEmployeeJourneyProjections(employeeId).catch((): JourneyProjectionList => []) : Promise.resolve<JourneyProjectionList>([]),
      tab === 'notes' ? employeeNotesPermissionAllowed(employeeId) : Promise.resolve(false),
    ]))
    const base = [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases, selfReport, journeys] as const
    const [canWriteNotes, canDeleteNotes, canUseAi, notes] = canReadNotes
      ? await performance.measure('notes.parallel', () => Promise.all([
        permissionAllowed('employee-note:write', employeeId),
        permissionAllowed('employee-note:delete', employeeId),
        permissionAllowed('ai:use', employeeId),
        listEmployeeNotes(employeeId),
      ]))
      : [false, false, false, []]
    return [...base, notes, canReadNotes, canWriteNotes, canDeleteNotes, canUseAi] as const
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
  const { tab: requestedTab, edit, view, caseId, perf, from, returnTo } = await searchParams
  const insightReturnTo = from === 'insights' ? normalizeInsightReturnPath(returnTo) : null
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
  const [detail, customFields, reminders, roleAssignments, canManageEmployments, locale, preferences, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments, dashboardDocuments, dashboardLayout, dashboardActivity, canWriteActivity, payslips, canReadPayslips, absenceCases, selfReport, journeys, notes, canReadNotes, canWriteNotes, canDeleteNotes, canUseAi] = pageData
  performanceTrace.finish()
  const tProcess = await getTranslator('processAutomation', locale)
  const tWeather = await getTranslator('startpage', locale)
  const weatherLabels = { weatherTitle: tWeather('weatherTitle'), weatherOpen: tWeather('weatherOpen'), weatherClose: tWeather('weatherClose'), weatherUnavailable: tWeather('weatherUnavailable'), weatherToday: tWeather('weatherToday'), weatherTomorrow: tWeather('weatherTomorrow'), weatherNextWorkingDay: tWeather('weatherNextWorkingDay'), weatherDayToggle: tWeather('weatherDayToggle'), weatherTodayMax: tWeather('weatherTodayMax'), weatherForecastHigh: tWeather('weatherForecastHigh'), weatherForecastLow: tWeather('weatherForecastLow'), weatherPressureUp: tWeather('weatherPressureUp'), weatherPressureDown: tWeather('weatherPressureDown'), weatherPressureSteady: tWeather('weatherPressureSteady'), weatherHumidity: tWeather('weatherHumidity'), weatherWind: tWeather('weatherWind'), weatherPressure: tWeather('weatherPressure'), weatherLocationToggle: tWeather('weatherLocationToggle'), weatherWork: tWeather('weatherWork'), weatherHome: tWeather('weatherHome') }
  const canStartProcess = authContext.permissions.includes('process-instance:start') || (authContext.permissions.includes('self:process-instance:start') && authContext.employeeId === employeeId)
  const processWork = (tab === 'overview' || tab === 'processes') && canReadProcesses
    ? await listProcessWork({ subjectEmployeeId: employeeId, tab: 'ALL', language: locale }).catch(() => null)
    : null
  const canWriteAbsenceForEmployee = tab === 'overview' || tab === 'absence' ? await permissionAllowed('absence:write', employeeId) : false
  const absenceEmploymentSelection = canWriteAbsenceForEmployee
    ? await listEmployeeAbsenceEmploymentOptions(employeeId).catch(() => ({ options: [] }))
    : { options: [] }
  const reportableAbsenceEmploymentOptions = getReportableAbsenceEmploymentOptions(absenceEmploymentSelection.options, absenceCases)
  const canReportAbsence = canWriteAbsenceForEmployee && (authContext.employeeId !== employeeId || selfReport) && reportableAbsenceEmploymentOptions.length > 0
  const canRecoverAbsence = authContext.permissions.includes('absence:recover')
  const canChangeAbsenceCapacity = authContext.permissions.includes('absence:write')
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
  const processStatusTones: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
    OPEN: 'info', CLAIMED: 'info', BLOCKED: 'danger', COMPLETED: 'success', CANCELLED: 'warning', EXPIRED: 'warning',
  }
  const processStatusTone = (status: string) => processStatusTones[status] ?? 'neutral'
  const processStatusForItem = (item: { status: string; instanceStatus: string }) => item.instanceStatus === 'BLOCKED' ? 'BLOCKED' : item.status
  const profileContext = [detail.currentEmploymentSummary.jobTitle, detail.currentEmploymentSummary.departmentName]
    .filter((value): value is string => Boolean(value))
    .join(' · ')

  return (
      <PageShell width="standard" className="py-7 lg:py-10">
        <Link href={insightReturnTo ?? '/employees'} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployees('title')}
        </Link>
        <Surface className={`relative mt-5 overflow-hidden ${compact ? 'p-2.5 sm:px-4' : ''}`}>
          {compact ? <><div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EmployeeAvatarManager compact employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} gender={detail.employee.gender} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed'), close: tEmployees('cancel'), removeTitle: tEmployees('photoRemoveTitle'), removeDescription: tEmployees('photoRemoveDescription'), removeConfirm: tEmployees('photoRemoveConfirm'), removeCancel: tEmployees('cancel') }} />
              <div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-tight">{detail.employee.firstName} {detail.employee.birthName}</h1>{profileContext ? <p className="truncate text-xs text-muted-foreground">{profileContext}</p> : null}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2"><EmployeeWeatherDrawer homeWeather={privateWeather} labels={weatherLabels} locale={locale} weather={workWeather} /><Link aria-label={tEmployees('expand')} href={`/employees/${employeeId}?tab=${tab}&view=expanded`} prefetch={false} title={tEmployees('expand')} className="button-secondary inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center p-0"><Maximize2 aria-hidden="true" size={18} /></Link></div>
          </div><EmployeeCalendarHeader items={calendarHeader} locale={locale} labels={{ holiday: tEmployees('nextHoliday'), activity: tEmployees('nextCompanyActivity') }} /></> : <>
            <div aria-hidden="true" className="h-16 border-b border-subtle bg-surface-subtle sm:h-20" />
            <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
              <div className="-mt-12 grid gap-x-8 gap-y-5 md:-mt-14 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end">
                <div className="md:self-start"><EmployeeAvatarManager employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} gender={detail.employee.gender} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed'), close: tEmployees('cancel'), removeTitle: tEmployees('photoRemoveTitle'), removeDescription: tEmployees('photoRemoveDescription'), removeConfirm: tEmployees('photoRemoveConfirm'), removeCancel: tEmployees('cancel') }} /></div>
                <div className="min-w-0 self-end text-center md:text-left">
                  <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{detail.employee.firstName} {detail.employee.birthName}</h1>
                  {profileContext ? <p className="mt-2 truncate text-sm font-medium text-muted-foreground">{profileContext}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    {detail.employee.isArchived && <Badge tone="warning">{tEmployees('archived')}</Badge>}
                    <Badge tone={detail.employee.isActive ? 'success' : 'info'}>{statusLabel}</Badge>
                    <span className="text-xs text-muted-foreground">{tEmployees('employeeNumber')}: {detail.employee.employeeNumber}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 md:max-w-[15rem] md:justify-end">
                  <EmployeeWeatherDrawer homeWeather={privateWeather} labels={weatherLabels} locale={locale} weather={workWeather} />
                  <Link aria-label={tEmployees('compact')} href={`/employees/${employeeId}?tab=${tab}&view=compact`} prefetch={false} title={tEmployees('compact')} className="button-secondary inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center p-0"><Minimize2 aria-hidden="true" size={18} /></Link>
                  <EmployeeArchiveToggle headerStyle employeeId={employeeId} archived={detail.employee.isArchived} hasActiveEmployment={detail.employments.some((employment) => employment.record_status === 'CONFIRMED')} labels={{ archive: tEmployees('archiveEmployee'), unarchive: tEmployees('unarchiveEmployee'), archiveTitle: tEmployees('archiveConfirmTitle'), unarchiveTitle: tEmployees('unarchiveConfirmTitle'), archiveBody: tEmployees('archiveConfirmBody'), archiveAction: tEmployees('archiveConfirmAction'), cancel: tEmployees('archiveCancel'), saved: tEmployees('archiveSaved'), failed: tEmployees('archiveFailed'), notFound: tEmployees('archiveNotFound'), hasActiveEmployment: tEmployees('hasActiveEmployment') }} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-subtle pt-4 text-sm text-muted-foreground">
                <span className="flex min-w-0 items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{(detail.employee.workEmail ?? detail.employee.privateEmail) ? <EmailLink className="text-primary hover:underline" email={detail.employee.workEmail ?? detail.employee.privateEmail ?? ''} /> : tEmployees('noEmail')}</span></span>
                {(detail.employee.workPhone ?? detail.employee.workMobile) && <a className="flex items-center gap-2 hover:text-foreground" href={`tel:${detail.employee.workPhone ?? detail.employee.workMobile}`}><Phone aria-hidden="true" className="h-4 w-4 shrink-0" />{detail.employee.workPhone ?? detail.employee.workMobile}</a>}
                <span className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4 shrink-0" />{tEmployees('employmentCount', { count: detail.employments.length })}</span>
              </div>
              <EmployeeCalendarHeader items={calendarHeader} locale={locale} labels={{ holiday: tEmployees('nextHoliday'), activity: tEmployees('nextCompanyActivity') }} />
            </div>
          </>}
        </Surface>

        <nav className="mt-6" aria-label={tEmployees('tabsLabel')}>
          <ScrollableTabs ariaLabel={tEmployees('tabsLabel')} leftLabel={tEmployees('previous')} rightLabel={tEmployees('next')} contentProps={{ role: 'tablist' }}>
            {(['overview', 'personal', 'employments', 'reminders', 'documents', 'absence', ...(canReadProcesses ? ['processes' as const] : []), ...(canReadPayslips ? ['payslips' as const] : []), ...(canReadNotes ? ['notes' as const] : [])] as const).map((item) => {
              const active = tab === item
              const label = item === 'overview' ? tEmployees('tabDashboard') : item === 'personal' ? tEmployees('tabPersonal') : item === 'employments' ? tEmployees('tabEmployments') : item === 'reminders' ? tEmployees('tabReminders') : item === 'documents' ? tEmployees('tabDocuments') : item === 'absence' ? tEmployees('absenceTab') : item === 'processes' ? tProcess('processesTab') : item === 'payslips' ? tDocuments('payslipsTab') : tEmployees('tabNotes')
              return <Link prefetch={false} key={item} href={`/employees/${employeeId}?tab=${item}&view=${compact ? 'compact' : 'expanded'}`} aria-current={active ? 'page' : undefined} className={tabLinkClasses({ active })}>{label}</Link>
            })}
          </ScrollableTabs>
        </nav>

        {tab === 'overview' && <EmployeeDashboard journeys={journeys} journeyLabels={{ journeys: tEmployees('journeys'), journeysDescription: tEmployees('journeysDescription'), journeysEmpty: tEmployees('journeysEmpty'), journeysOpen: tEmployees('journeysOpen'), journeyProgress: tEmployees('journeyProgress') }} selfReportAbsence={selfReport} canReportAbsence={canReportAbsence} canRecoverAbsence={canRecoverAbsence} canChangeAbsenceCapacity={canChangeAbsenceCapacity} canManageEmployments={canManageEmployments} absence={absenceOverview} absenceEmploymentOptions={reportableAbsenceEmploymentOptions} detail={detail} customFields={customFields} documents={dashboardDocuments} reminders={reminders} activity={dashboardActivity} canWriteActivity={canWriteActivity} initialLayout={dashboardLayout} compact={compact} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} processWork={processWork} canReadProcesses={canReadProcesses} canStartProcess={canStartProcess} labels={{
          title: tEmployees('dashboardTitle'), subtitle: tEmployees('dashboardSubtitle'), openDetails: tEmployees('dashboardOpenDetails'), edit: tEmployees('editPersonal'), personal: tEmployees('dashboardPersonal'), contact: tEmployees('contactTitle'),
          workContact: tEmployees('workContact'), privateContact: tEmployees('privateContact'), noContact: tEmployees('noContact'), address: tEmployees('currentAddress'), noAddress: tEmployees('noAddress'), birthDate: tEmployees('birthDate'),
          nationality: tEmployees('nationality'), birthPlace: tEmployees('birthPlace'), gender: tEmployees('gender'), notRecorded: tEmployees('notRecorded'), customFields: tCustomFields('employeeTitle'), customFieldsEmpty: tEmployees('dashboardCustomFieldsEmpty'),
          employment: tEmployees('dashboardEmployment'), employmentEmpty: tEmployees('dashboardEmploymentEmpty'), department: tEmployees('department'), jobTitle: tEmployees('jobTitle'), manager: tEmployees('manager'), hoursPerWeek: tEmployees('hoursPerWeek'), salary: tEmployees('salary'),
          salaryHidden: tEmployees('salaryRevealHelp'), salaryNotAvailable: tEmployees('dashboardSalaryNotAvailable'), salaryMonthly: tEmployees('salaryMonthlySuffix'), salaryHourly: tEmployees('salaryHourlySuffix'), salaryLoading: tEmployees('dashboardSalaryLoading'), salaryFailed: tEmployees('dashboardSalaryFailed'), leave: tEmployees('dashboardLeave'), leaveDescription: tEmployees('dashboardLeaveDescription'),
          absence: tEmployees('dashboardAbsence'), absenceLatestCase: tEmployees('absenceLatestCase'), absenceEndDate: tEmployees('absenceEndDate'), absenceSickDays: tEmployees('absenceSickDays'), absenceOngoing: tEmployees('absenceOngoing'), budgets: tEmployees('dashboardBudgets'), budgetsDescription: tEmployees('dashboardBudgetsDescription'), contracts: tEmployees('dashboardContracts'), contractsDescription: tEmployees('dashboardContractsDescription'),
          contractCount: tEmployees('dashboardContractCount'), employmentNumber: tEmployment('employmentNumber'), employmentPeriod: tEmployment('period'), employmentActive: tEmployment('active'), employmentFuture: tEmployment('future'), employmentEnded: tEmployment('ended'), employmentNoActive: tEmployment('dashboardNoActive'), employmentAdd: tEmployment('dashboardAddEmployment'), laborConditions: tEmployment('laborConditions'), workerType: tEmployment('workerType'), workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'), workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerExternal: tEmployment('workerExternal'), workerFreelancer: tEmployment('workerFreelancer'), workerVolunteer: tEmployment('workerVolunteer'), workerNoPayroll: tEmployment('workerNoPayroll'), activity: tEmployees('dashboardActivity'), activityDescription: tEmployees('dashboardActivityDescription'), activityEmpty: tEmployees('dashboardActivityEmpty'), activityAdd: tEmployees('dashboardActivityAdd'), activityPlaceholder: tEmployees('dashboardActivityPlaceholder'), activitySave: tEmployees('dashboardActivitySave'), activitySaving: tEmployees('dashboardActivitySaving'), activityFailed: tEmployees('dashboardActivityFailed'), reminders: tEmployees('tabReminders'), remindersEmpty: tEmployees('remindersEmpty'), workflows: tEmployees('dashboardWorkflows'), workflowsDescription: tEmployees('dashboardWorkflowsDescription'), workflowsOpen: tEmployees('dashboardWorkflowsOpen'), workflowsEmpty: tEmployees('dashboardWorkflowsEmpty'), workflowsUnavailable: tEmployees('dashboardWorkflowsUnavailable'), workflowsBlocked: tEmployees('dashboardWorkflowsBlocked'), workflowsOverdue: tEmployees('dashboardWorkflowsOverdue'), workflowsStart: tEmployees('dashboardWorkflowsStart'),
          assets: tEmployees('dashboardAssets'), assetsDescription: tEmployees('dashboardAssetsDescription'), vehicles: tEmployees('dashboardVehicles'), vehiclesDescription: tEmployees('dashboardVehiclesDescription'), software: tEmployees('dashboardSoftware'), softwareDescription: tEmployees('dashboardSoftwareDescription'),
          education: tEmployees('dashboardEducation'), educationDescription: tEmployees('dashboardEducationDescription'), documents: tEmployees('tabDocuments'), documentsEmpty: tEmployees('dashboardDocumentsEmpty'), performance: tEmployees('dashboardPerformance'),
          performanceDescription: tEmployees('dashboardPerformanceDescription'), futureModule: tEmployees('dashboardFutureModule'), futureModuleDescription: tEmployees('dashboardFutureModuleDescription'), viewContracts: tEmployees('tabEmployments'), viewDocuments: tEmployees('tabDocuments'), viewReminders: tEmployees('tabReminders'), moveUp: tEmployees('dashboardMoveUp'), moveDown: tEmployees('dashboardMoveDown'), drag: tEmployees('dashboardDrag'), layoutSaving: tEmployees('dashboardLayoutSaving'), layoutSaved: tEmployees('dashboardLayoutSaved'), layoutFailed: tEmployees('dashboardLayoutFailed'), profileLinks: tEmployees('profileLinks'), noProfileLinks: tEmployees('noProfileLinks'), addProfileLink: tEmployees('addProfileLink'), linkLabel: tEmployees('linkLabel'), linkUrl: tEmployees('linkUrl'), saveLink: tEmployees('saveLink'), linkFailed: tEmployees('linkFailed'), absenceReport: tEmployees('absenceReport'), absenceStartDate: tEmployees('absenceStartDate'), absencePercentage: tEmployees('absencePercentage'), absenceExpectedRecovery: tEmployees('absenceExpectedRecovery'), absenceHasSafetyNet: tEmployees('absenceHasSafetyNet'), absenceWorkAccident: tEmployees('absenceWorkAccident'), absenceThirdPartyAccident: tEmployees('absenceThirdPartyAccident'), absenceUnknown: tEmployees('absenceUnknown'), absenceYes: tEmployees('absenceYes'), absenceNo: tEmployees('absenceNo'), absenceSubmit: tEmployees('absenceSubmit'), absenceRecover: tEmployees('absenceRecover'), absenceRecoveredOn: tEmployees('absenceRecoveredOn'), absenceSaveFailed: tEmployees('absenceSaveFailed'), absenceNowSick: tEmployees('absenceNowSick'), absenceNowNotSick: tEmployees('absenceNowNotSick'), absenceLastReport: tEmployees('absenceLastReport'), absenceNoHistory: tEmployees('absenceNoHistory'), absenceActiveSince: tEmployees('absenceActiveSince'), absenceRecoveryWindow: tEmployees('absenceRecoveryWindow'), absenceOpenCase: tEmployees('absenceOpenCase'), absenceClose: tEmployees('absenceClose'), absenceCaseNextReview: tEmployees('absenceCaseNextReview'), absenceHours: tEmployees('absenceHours'), absenceCapacityInputMode: tEmployees('absenceCapacityInputMode'), absenceCapacityPercentageMode: tEmployees('absenceCapacityPercentageMode'), absenceCapacityHoursMode: tEmployees('absenceCapacityHoursMode'), absenceCapacityScheduleUnavailable: tEmployees('absenceCapacityScheduleUnavailable'), absenceDiscardTitle: tEmployees('absenceDiscardTitle'), absenceDiscardDescription: tEmployees('absenceDiscardDescription'), absenceDiscardConfirm: tEmployees('absenceDiscardConfirm'), absenceDiscardCancel: tEmployees('absenceDiscardCancel'), name: tEmployees('name'), age: tEmployees('age'), daysUntilBirthday: tEmployees('daysUntilBirthday'), workEmail: tEmployees('workEmail'), privateEmail: tEmployees('privateEmail'), workPhone: tEmployees('workPhone'), privatePhone: tEmployees('privatePhone'),
        }} />}

        {tab === 'processes' && <section className="mt-8 space-y-5"><SectionHeader title={tProcess('workspaceTitle')} description={tProcess('workspaceDescription')} />{!processWork ? <Surface className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{tProcess('readError')}</Surface> : processWork.items.length === 0 ? <EmptyState description={tProcess('noItemsDescription')} role="status" title={tProcess('noItems')} /> : <div className="grid gap-4">{processWork.items.map((item) => { const itemStatus = processStatusForItem(item); return <Surface className="p-5" key={item.workItemId}><article><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{item.processKey}</p><h3 className="mt-1 break-words font-semibold">{item.processTitle}</h3></div><Badge tone={processStatusTone(itemStatus)}>{processStatusLabel(itemStatus)}</Badge></div><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div className="min-w-0"><dt className="text-xs text-muted-foreground">{tProcess('step')}</dt><dd className="mt-1 break-words">{item.stepTitle}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">{tProcess('subject')}</dt><dd className="mt-1 break-words">{item.subjectName ?? tProcess('unknown')}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">{tProcess('deadline')}</dt><dd className="mt-1 break-words">{item.deadlineAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(item.deadlineAt)) : tProcess('unknown')}</dd></div></dl><Link prefetch={false} className={buttonClasses({ variant: 'secondary', className: 'mt-5 w-full sm:w-auto' })} href={`/work/${item.workItemId}`}>{tProcess('open')}</Link></article></Surface> })}</div>}</section>}

        {tab === 'absence' && (selectedAbsenceCase ? <section className="mt-8"><AbsenceCaseDetail employeeId={employeeId} employmentId={selectedAbsenceCase.employmentId} compact={compact} absenceCase={selectedAbsenceCase} locale={locale} dateFormat={preferences.dateFormat} labels={{ title: tEmployees('absenceCaseDetail'), dossier: tEmployees('absenceCaseDossier'), heading: tEmployees('absenceCaseHeading'), back: tEmployees('absenceCaseBack'), status: tEmployees('absenceCaseStatus'), firstAbsence: tEmployees('absenceCaseFirstAbsence'), effectiveClockStart: tEmployees('absenceCaseEffectiveClockStart'), recoveryWindowEnds: tEmployees('absenceCaseRecoveryWindowEnds'), closedAt: tEmployees('absenceCaseClosedAt'), periods: tEmployees('absenceCasePeriods'), reportedAt: tEmployees('absenceCaseReportedAt'), expectedRecovery: tEmployees('absenceCaseExpectedRecovery'), recoveredOn: tEmployees('absenceCaseRecoveredOn'), capacity: tEmployees('absenceCaseCapacity'), capacityEffectiveOn: tEmployees('absenceCaseCapacityEffectiveOn'), nextReview: tEmployees('absenceCaseNextReview'), capacityHistory: tEmployees('absenceCaseCapacityHistory'), absenceHours: tEmployees('absenceHours'), capacityInputMode: tEmployees('absenceCapacityInputMode'), percentageMode: tEmployees('absenceCapacityPercentageMode'), hoursMode: tEmployees('absenceCapacityHoursMode'), scheduleUnavailable: tEmployees('absenceCapacityScheduleUnavailable'), safetyNet: tEmployees('absenceHasSafetyNet'), workAccident: tEmployees('absenceWorkAccident'), thirdPartyAccident: tEmployees('absenceThirdPartyAccident'), frequentAbsence: tEmployees('absenceFrequent'), priorCases: tEmployees('absenceCasePriorCases'), threshold: tEmployees('absenceCaseThreshold'), noValue: tEmployees('absenceCaseNoValue'), yes: tEmployees('absenceYes'), no: tEmployees('absenceNo'), unknown: tEmployees('absenceUnknown'), nowSick: tEmployees('absenceNowSick'), nowNotSick: tEmployees('absenceNowNotSick'), recoveryWindow: tEmployees('absenceRecoveryWindow'), report: tEmployees('absenceReport'), startDate: tEmployees('absenceStartDate'), percentage: tEmployees('absencePercentage'), expectedRecoveryInput: tEmployees('absenceExpectedRecovery'), submit: tEmployees('absenceSubmit'), better: tEmployees('absenceRecover'), partialRecover: tEmployees('absencePartialRecover'), capacitySave: tEmployees('absenceCapacitySave'), saveFailed: tEmployees('absenceSaveFailed'), close: tEmployees('absenceClose'), canRecover: canRecoverAbsence, canChangeCapacity: canChangeAbsenceCapacity, discardTitle: tEmployees('absenceDiscardTitle'), discardDescription: tEmployees('absenceDiscardDescription'), discardConfirm: tEmployees('absenceDiscardConfirm'), discardCancel: tEmployees('absenceDiscardCancel') }} /></section> : <section className="mt-8 space-y-6"><SectionHeader title={tEmployees('dashboardAbsence')} /> <AbsenceQuickForm employeeId={employeeId} employmentId={absenceOverview?.employmentId ?? (reportableAbsenceEmploymentOptions.length === 1 ? reportableAbsenceEmploymentOptions[0]?.id : undefined)} employmentOptions={reportableAbsenceEmploymentOptions} currentCase={absenceOverview} allowReportWithOpenCase={reportableAbsenceEmploymentOptions.length > 0} selfService={selfReport} canReport={canReportAbsence} canRecover={canRecoverAbsence} canChangeCapacity={canChangeAbsenceCapacity} recoveryMode="hidden" showReportAction={canReportAbsence} labels={{ report: tEmployees('absenceReport'), startDate: tEmployees('absenceStartDate'), percentage: tEmployees('absencePercentage'), expectedRecovery: tEmployees('absenceExpectedRecovery'), hasSafetyNet: tEmployees('absenceHasSafetyNet'), workAccident: tEmployees('absenceWorkAccident'), thirdPartyAccident: tEmployees('absenceThirdPartyAccident'), unknown: tEmployees('absenceUnknown'), yes: tEmployees('absenceYes'), no: tEmployees('absenceNo'), submit: tEmployees('absenceSubmit'), recover: tEmployees('absenceRecover'), capacitySave: tEmployees('absenceCapacitySave'), recoveredOn: tEmployees('absenceRecoveredOn'), failed: tEmployees('absenceSaveFailed'), close: tEmployees('absenceClose'), selfServiceIntro: tEmployees('absenceNoHistory'), employment: tEmployees('absenceEmployment'), employmentPlaceholder: tEmployees('absenceEmploymentPlaceholder'), employmentSearch: tEmployees('absenceEmploymentSearch'), capacityInputMode: tEmployees('absenceCapacityInputMode'), percentageMode: tEmployees('absenceCapacityPercentageMode'), hoursMode: tEmployees('absenceCapacityHoursMode'), capacityHours: tEmployees('absenceHours'), scheduleUnavailable: tEmployees('absenceCapacityScheduleUnavailable'), discardTitle: tEmployees('absenceDiscardTitle'), discardDescription: tEmployees('absenceDiscardDescription'), discardConfirm: tEmployees('absenceDiscardConfirm'), discardCancel: tEmployees('absenceDiscardCancel') }} /><AbsenceCaseList employeeId={employeeId} compact={compact} cases={absenceCases} labels={{ title: tEmployees('absenceCaseDetail'), nowSick: tEmployees('absenceNowSick'), nowNotSick: tEmployees('absenceNowNotSick'), recoveryWindow: tEmployees('absenceRecoveryWindow'), periods: tEmployees('absenceCasePeriods'), open: tEmployees('absenceCaseOpen'), empty: tEmployees('absenceEmpty') }} /></section>)}

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
            employmentCount: tEmployees('employmentCount'), personalTitle: tEmployees('personalTitle'), previous: tEmployees('previous'), next: tEmployees('next'), editPersonal: tEmployees('editPersonal'),
            save: tEmployees('save'), saving: tEmployees('saving'), saved: tEmployees('saved'), cancel: tEmployees('cancel'), genericError: tErrors('generic'), close: tEmployees('cancel'), moreActions: tEmployees('moreActions'), discardTitle: tEmployees('discardTitle'), discardDescription: tEmployees('discardDescription'), discardConfirm: tEmployees('discardConfirm'), discardCancel: tEmployees('discardCancel'),
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
            primary: tEmployees('primary'), iban: tEmployees('iban'), ibanEditHelp: tEmployees('ibanEditHelp'), bic: tEmployees('bic'), accountHolder: tEmployees('accountHolder'),
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

        {tab === 'documents' && canReadDocuments && <EmployeeDocumentDossier employeeId={employeeId} documents={documents} options={documentOptions} canWrite={canWriteDocuments} canDelete={canDeleteDocuments} labels={{ title: tDocuments('title'), subtitle: tDocuments('subtitle'), upload: tDocuments('upload'), uploadAdvanced: tDocuments('uploadAdvanced'), file: tDocuments('file'), fileDropTitle: tDocuments('fileDropTitle'), fileDropHelp: tDocuments('fileDropHelp'), fileSelected: tDocuments('fileSelected'), fileReplace: tDocuments('fileReplace'), fileRemove: tDocuments('fileRemove'), fileRules: tDocuments('fileRules'), documentTitle: tDocuments('documentTitle'), description: tDocuments('description'), tags: tDocuments('tags'), noCloudTags: tDocuments('noCloudTags'), category: tDocuments('category'), customMetadata: tDocuments('customMetadata'), automaticValue: tDocuments('automaticValue'), requiredFields: tDocuments('requiredFields'), advancedSettings: tDocuments('advancedSettings'), visibleToTitle: tDocuments('visibleToTitle'), visibleToEmployee: tDocuments('visibleToEmployee'), visibleToRole: tDocuments('visibleToRole'), visibleToDepartment: tDocuments('visibleToDepartment'), visibilityDefault: tDocuments('visibilityDefault'), reminderTitle: tDocuments('reminderTitle'), expiresOn: tDocuments('expiresOn'), reminderAt: tDocuments('reminderAt'), reminderForEmployee: tDocuments('reminderForEmployee'), reminderForRole: tDocuments('reminderForRole'), save: tDocuments('save'), saving: tDocuments('saving'), failed: tDocuments('failed'), empty: tDocuments('empty'), download: tDocuments('download'), delete: tDocuments('delete'), restore: tDocuments('restore'), deleteReason: tDocuments('deleteReason'), deleted: tDocuments('deleted'), expires: tDocuments('expires'), reminderActive: tDocuments('reminderActive'), addedOn: tDocuments('addedOn'), employeeVisibilityAllowed: tDocuments('employeeVisibilityAllowed'), employeeVisibilityBlocked: tDocuments('employeeVisibilityBlocked'), additionalRoles: tDocuments('additionalRoles'), additionalDepartments: tDocuments('additionalDepartments'), noExtraVisibility: tDocuments('noExtraVisibility'), noReminderRecipients: tDocuments('noReminderRecipients'), invalidType: tDocuments('invalidType'), invalidSize: tDocuments('invalidSize'), invalidInput: tDocuments('invalidInput'), audienceRequired: tDocuments('audienceRequired'), expiryRequired: tDocuments('expiryRequired'), reminderTargetRequired: tDocuments('reminderTargetRequired'), singleFileOnly: tDocuments('singleFileOnly'), view: tDocuments('view'), viewerClose: tDocuments('viewerClose'), viewerUnsupported: tDocuments('viewerUnsupported'), cancel: tDocuments('cancel'), close: tDocuments('viewerClose'), moreActions: tDocuments('moreActions'), discardTitle: tDocuments('discardTitle'), discardDescription: tDocuments('discardDescription'), discardConfirm: tDocuments('discardConfirm'), discardCancel: tDocuments('discardCancel'), deleteTitle: tDocuments('deleteTitle'), deleteDescription: tDocuments('deleteDescription'), deleteConfirm: tDocuments('deleteConfirm'), deleteCancel: tDocuments('deleteCancel'), restoreTitle: tDocuments('restoreTitle'), restoreDescription: tDocuments('restoreDescription'), restoreConfirm: tDocuments('restoreConfirm'), restoreCancel: tDocuments('restoreCancel') }} />}

        {tab === 'payslips' && canReadPayslips && <EmployeePayslips employeeId={employeeId} payslips={payslips} labels={{ title: tDocuments('payslipsTitle'), subtitle: tDocuments('payslipsSubtitle'), empty: tDocuments('payslipsEmpty'), view: tDocuments('view'), download: tDocuments('download'), close: tDocuments('viewerClose'), unsupported: tDocuments('viewerUnsupported'), source: tDocuments('payslipSource'), imported: tDocuments('payslipImported') }} />}

        {tab === 'reminders' && <EmployeeReminders employeeId={employeeId} mode={authContext.employeeId === employeeId ? 'PERSONAL' : 'HR'} canManageHr={authContext.permissions.includes('reminder:write')} reminders={reminders} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{ title: tEmployees('remindersTitle'), empty: tEmployees('remindersEmpty'), add: tEmployees('addReminder'), edit: tEmployees('editReminder'), remove: tEmployees('deleteReminder'), titleLabel: tEmployees('reminderTitle'), descriptionLabel: tEmployees('reminderDescription'), dateLabel: tEmployees('reminderDate'), save: tEmployees('saveReminder'), saved: tEmployees('reminderSaved'), failed: tErrors('generic'), futureTime: tEmployees('reminderFutureTime'), cancel: tEmployees('cancel'), close: tEmployees('reminderClose'), moreActions: tEmployees('reminderMoreActions'), personalReminder: tEmployees('personalReminder'), hrReminder: tEmployees('hrReminder'), discardTitle: tEmployees('reminderDiscardTitle'), discardDescription: tEmployees('reminderDiscardDescription'), discardConfirm: tEmployees('reminderDiscardConfirm'), discardCancel: tEmployees('reminderDiscardCancel'), deleteTitle: tEmployees('reminderDeleteTitle'), deleteDescription: tEmployees('reminderDeleteDescription'), deleteConfirm: tEmployees('reminderDeleteConfirm'), deleteCancel: tEmployees('reminderDeleteCancel'), shiftDayBack: tEmployees('reminderDayBack'), shiftDayForward: tEmployees('reminderDayForward'), shiftWeekForward: tEmployees('reminderWeekForward'), shiftMonthForward: tEmployees('reminderMonthForward') }} />}

        {tab === 'notes' && canReadNotes && <EmployeeNotes employeeId={employeeId} notes={notes} canWrite={canWriteNotes} canDelete={canDeleteNotes} canImproveWithAi={canWriteNotes && canUseAi && isAiImproveAvailable()} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} labels={{ title: tEmployees('notesTitle'), accessNotice: tEmployees('notesAccessNotice'), empty: tEmployees('notesEmpty'), add: tEmployees('addNote'), edit: tEmployees('editNote'), remove: tEmployees('deleteNote'), noteTitle: tEmployees('noteTitle'), description: tEmployees('description'), author: tEmployees('noteAuthor'), createdAt: tEmployees('noteCreatedAt'), save: tEmployees('saveNote'), cancel: tEmployees('cancel'), close: tEmployees('cancel'), moreActions: tEmployees('moreActions'), saving: tEmployees('saving'), failed: tErrors('generic'), saved: tEmployees('noteSaved'), discardTitle: tEmployees('discardTitle'), discardDescription: tEmployees('discardDescription'), discardConfirm: tEmployees('discardConfirm'), discardCancel: tEmployees('discardCancel'), deleteTitle: tEmployees('deleteTitle'), deleteDescription: tEmployees('deleteDescription'), deleteConfirm: tEmployees('deleteConfirm'), deleteCancel: tEmployees('cancel'), improveWithAi: tEmployees('improveWithAi'), improveWriting: tEmployees('improveWriting'), makeShorter: tEmployees('makeShorter'), makeProfessional: tEmployees('makeProfessional'), aiWorking: tEmployees('aiWorking'), aiReviewTitle: tEmployees('aiReviewTitle'), applyAi: tEmployees('applyAi'), cancelAi: tEmployees('cancelAi'), aiFailed: tErrors('generic') }} />}

        {tab === 'employments' && <div className="mt-8">
          <section className="space-y-5">
            <SectionHeader title={tEmployment('title')} actions={canManageEmployments ? <NewEmploymentButton href={`/employees/${employeeId}/employments/new`} hasActiveEmployment={hasActiveEmployment(detail.employments.map((employment) => ({ startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status })), new Date().toISOString().slice(0, 10))} labels={{ new: tEmployment('new'), confirmationTitle: tEmployment('parallelConfirmationTitle'), confirmationDescription: tEmployment('parallelConfirmationDescription'), confirmationConfirm: tEmployment('parallelConfirmationConfirm'), confirmationCancel: tEmployment('parallelConfirmationCancel') }} /> : null} />
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
        </div>}
      </PageShell>
  )
}
