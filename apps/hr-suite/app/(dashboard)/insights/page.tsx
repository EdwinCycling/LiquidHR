import { InsightsWorkspace } from '@/components/insights/insights-workspace'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getEmployeeInsightReport } from '@/lib/insights/employee-report-service'
import { parseEmployeeInsightQuery } from '@/lib/insights/query'
import { INSIGHT_REPORTS, isEmployeeInsightReportId } from '@/lib/insights/report-catalog'
import { getUpcomingEventsReport } from '@/lib/insights/upcoming-events'
import { parseUpcomingEventsQuery } from '@/lib/insights/upcoming-events-query'
import { getTranslator } from '@/lib/i18n/server'
import { getInsightsPreferences } from '@/lib/preferences/insights'
import { getUserPreferences } from '@/lib/preferences/server'

interface InsightsPageProps { searchParams: Promise<Record<string, string | string[] | undefined>> }

function toSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) { if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry)); else if (value) params.set(key, value) }
  return params
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const [t, rawParams, context, preferences, userPreferences] = await Promise.all([getTranslator('insights'), searchParams, requireAuthContext(), getInsightsPreferences(), getUserPreferences()])
  const reports = INSIGHT_REPORTS.filter((report) => context.permissions.includes(report.permission))
  const params = toSearchParams(rawParams)
  const query = parseEmployeeInsightQuery(params)
  const reportData = query && reports.some((report) => report.id === query.report) && isEmployeeInsightReportId(query.report) ? await getEmployeeInsightReport(query) : null
  const upcomingQuery = parseUpcomingEventsQuery(params)
  const upcomingReport = params.get('report') === 'upcomingEvents' ? await getUpcomingEventsReport(upcomingQuery) : null
  return <InsightsWorkspace upcomingQuery={upcomingQuery} upcomingReport={upcomingReport} labels={{
    eyebrow: t('eyebrow'), title: t('title'), intro: t('intro'), reportsAvailable: t('reportsAvailable'), available: t('available'), planned: t('planned'), openReport: t('openReport'), closeReport: t('closeReport'),
    leaveTitle: t('leaveTitle'), leaveDescription: t('leaveDescription'), employeesDepartmentTitle: t('employeesDepartmentTitle'), employeesDepartmentDescription: t('employeesDepartmentDescription'), employeesGenderTitle: t('employeesGenderTitle'), employeesGenderDescription: t('employeesGenderDescription'), employeesAgeTitle: t('employeesAgeTitle'), employeesAgeDescription: t('employeesAgeDescription'), terminationsTitle: t('terminationsTitle'), terminationsDescription: t('terminationsDescription'), upcomingEventsTitle: t('upcoming-eventsTitle'), upcomingEventsDescription: t('upcoming-eventsDescription'), absenceTitle: t('absenceTitle'), absenceDescription: t('absenceDescription'), provisionTitle: t('provisionTitle'), provisionDescription: t('provisionDescription'), wvpTitle: t('wvpTitle'), wvpDescription: t('wvpDescription'),
    backToInsights: t('backToInsights'), upcomingEventsEvent: t('upcomingEventsEvent'), upcomingEventsBirthdays: t('upcomingEventsBirthdays'), upcomingEventsAnniversaries: t('upcomingEventsAnniversaries'), upcomingEventsStarters: t('upcomingEventsStarters'), allEvents: t('allEvents'), selected: t('selected'), today: t('today'), inDays: t('inDays'), upcomingEventsNext7Days: t('upcomingEventsNext7Days'), upcomingEventsNext4Weeks: t('upcomingEventsNext4Weeks'), upcomingEventsNext12Weeks: t('upcomingEventsNext12Weeks'), upcomingEventsNext12Months: t('upcomingEventsNext12Months'), allDepartments: t('allDepartments'), searchDepartments: t('searchDepartments'), exportExcel: t('exportExcel'), upcomingEventsEmpty: t('upcomingEventsEmpty'), seniority: t('seniority'),
    employeesCategory: t('employeesCategory'), leaveCategory: t('leaveCategory'), absenceCategory: t('absenceCategory'), otherCategory: t('otherCategory'), groupBy: t('groupBy'), period: t('period'), gender: t('gender'), genderMale: t('genderMale'), genderFemale: t('genderFemale'), genderOther: t('genderOther'), genderUndisclosed: t('genderUndisclosed'), under20: t('under20'), age20to30: t('age20to30'), age30to40: t('age30to40'), age40to50: t('age40to50'), age50to60: t('age50to60'), over60: t('over60'), noTeam: t('noTeam'), noReason: t('noReason'), unknown: t('unknown'), sortBy: t('sortBy'), sortTotal: t('sortTotal'), sortName: t('sortName'), sortTrend: t('sortTrend'), person: t('person'), team: t('team'), allTeams: t('allTeams'), allSegments: t('allSegments'), segment: t('segment'), statusEmployee: t('statusEmployee'), statusAll: t('statusAll'), statusActive: t('statusActive'), statusFormer: t('statusFormer'), reason: t('reason'), age: t('age'), selectAll: t('selectAll'), search: t('search'), searchOptions: t('searchOptions'), noOptions: t('noOptions'), filterStatus: t('filterStatus'), noDataSourceTitle: t('noDataSourceTitle'), noDataSourceDescription: t('noDataSourceDescription'), noResults: t('noResults'), activeFilters: t('activeFilters'), privacyHint: t('privacyHint'), distribution: t('distribution'), trend: t('trend'), table: t('table'), jan: t('jan'), feb: t('feb'), mar: t('mar'), apr: t('apr'), may: t('may'), jun: t('jun'), jul: t('jul'), aug: t('aug'), sep: t('sep'), oct: t('oct'), nov: t('nov'), dec: t('dec'), fullYear: t('fullYear'), threeYears: t('threeYears'), fiveYears: t('fiveYears'), previousYear: t('previousYear'), nextYear: t('nextYear'), selectedPeriod: t('selectedPeriod'), people: t('people'), groups: t('groups'), actualDataTitle: t('actualDataTitle'), authorizedData: t('authorizedData'), employee: t('employee'), endDate: t('endDate'), exportCsv: t('exportCsv'), exportPreparing: t('exportPreparing'), exportSuccess: t('exportSuccess'), exportFailed: t('exportFailed'), preserveFilters: t('preserveFilters'), selectionOpen: t('selectionOpen'), selectionClose: t('selectionClose'),
  }} dateFormat={userPreferences.dateFormat} locale={userPreferences.locale === 'nl' ? 'nl-NL' : 'en-US'} reportData={reportData} reports={reports} preferences={preferences} />
}
