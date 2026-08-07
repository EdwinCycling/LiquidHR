import { redirect } from 'next/navigation'
import { StartPage } from '@/components/startpage/start-page'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getRequestUserPreferences } from '@/lib/preferences/server'
import { getStartPagePreferences } from '@/lib/preferences/start-page'
import { createServerPerformanceTrace } from '@/lib/performance/server-trace'
import { getStartPageData, type StartPageScope } from '@/lib/startpage/service'

interface StartPageRouteProps {
  searchParams: Promise<{ scope?: string; perf?: string }>
}

export default async function StartPageRoute({ searchParams }: StartPageRouteProps) {
  const { scope: requestedScope, perf } = await searchParams
  const performanceTrace = createServerPerformanceTrace('/dashboard/start', perf === '1')
  const requestContext = await performanceTrace.measure('auth.context', getRequestAuthorizationContext)
  const authContext = requestContext.context
  if (!authContext.permissions.includes('start-page:read')) {
    if (authContext.employeeId && authContext.permissions.includes('self:employee:read')) {
      redirect(`/employees/${authContext.employeeId}`)
    }
    redirect('/geen-toegang')
  }

  const scope: StartPageScope | undefined = requestedScope === 'company' || requestedScope === 'team' ? requestedScope : undefined
  const dataPromise = getStartPageData(scope, {
    supabase: requestContext.supabase,
    auth: requestContext.context,
    activeContext: requestContext.activeContext,
    performance: performanceTrace,
  })
  const [data, locale, preferences, translate, startPagePreferences] = await performanceTrace.measure('page.parallel', () => Promise.all([
    dataPromise,
    getLocale(),
    getRequestUserPreferences(),
    getTranslator('startpage'),
    getStartPagePreferences({ supabase: requestContext.supabase, userId: requestContext.context.userId }),
  ]))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? translate('goodMorning') : hour < 18 ? translate('goodAfternoon') : translate('goodEvening')
  performanceTrace.finish()

  return <StartPage data={data} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} logoUrl={preferences.companyBranding?.logoUrl} greeting={greeting} initialPreferences={startPagePreferences} labels={{
    weatherTitle: translate('weatherTitle'), weatherUnavailable: translate('weatherUnavailable'), weatherPressureUp: translate('weatherPressureUp'), weatherPressureDown: translate('weatherPressureDown'), weatherPressureSteady: translate('weatherPressureSteady'), weatherTodayMax: translate('weatherTodayMax'), weatherLocationToggle: translate('weatherLocationToggle'), weatherWork: translate('weatherWork'), weatherHome: translate('weatherHome'), weatherHomeUnavailable: translate('weatherHomeUnavailable'), nextLeave: translate('nextLeave'), nextHoliday: translate('nextHoliday'), eyebrow: translate('eyebrow'), headline: translate('headline'), subtitle: translate('subtitle'), activeScope: translate('activeScope'), administration: translate('administration'), tenant: translate('tenant'), peopleInScope: translate('peopleInScope'), operationalTitle: translate('operationalTitle'), operationalTitleTeam: translate('operationalTitleTeam'), operationalTitleCompany: translate('operationalTitleCompany'), scopeSwitchLabel: translate('scopeSwitchLabel'), scopeTeam: translate('scopeTeam'), scopeCompany: translate('scopeCompany'), openTeamEmployees: translate('openTeamEmployees'), liveSource: translate('liveSource'), documentsTitle: translate('documentsTitle'), documentsDescription: translate('documentsDescription'), openDocuments: translate('openDocuments'), notAvailable: translate('notAvailable'), yourPriorities: translate('yourPriorities'), prioritiesBody: translate('prioritiesBody'), remindersTitle: translate('remindersTitle'), remindersDescription: translate('remindersDescription'), openReminders: translate('openReminders'), noReminders: translate('noReminders'), moreReminders: translate('moreReminders'), workInProgress: translate('workInProgress'), workInProgressBody: translate('workInProgressBody'), futureDeclarations: translate('futureDeclarations'), futureContracts: translate('futureContracts'), futureAssets: translate('futureAssets'), futureTasks: translate('futureTasks'), futureSource: translate('futureSource'), openDashboard: translate('openDashboard'), quickLinks: translate('quickLinks'), workforceDescription: translate('workforceDescription'), openWorkforce: translate('openWorkforce'), workforceOpenItem: translate('workforceOpenItem'), workforceNineGrid: translate('workforceNineGrid'), workforceNineGridDescription: translate('workforceNineGridDescription'), workforceContinuousAppraisal: translate('workforceContinuousAppraisal'), workforceContinuousAppraisalDescription: translate('workforceContinuousAppraisalDescription'), workforceTalentProfiles: translate('workforceTalentProfiles'), workforceTalentProfilesDescription: translate('workforceTalentProfilesDescription'), workforceStarPerformers: translate('workforceStarPerformers'), workforceStarPerformersDescription: translate('workforceStarPerformersDescription'), workforceStarPerformerTags: translate('workforceStarPerformerTags'), workforceStarPerformerTagsDescription: translate('workforceStarPerformerTagsDescription'), quickActionsTitle: translate('quickActionsTitle'), myData: translate('myData'), myDataDescription: translate('myDataDescription'), myTeam: translate('myTeam'), myTeamDescription: translate('myTeamDescription'), newAbsence: translate('newAbsence'), newAbsenceDescription: translate('newAbsenceDescription'), calendar: translate('calendar'), insights: translate('insights'), updated: translate('updated'), fallbackName: translate('fallbackName'), absenceCasesTitle: translate('absenceCasesTitle'), absenceCasesDescription: translate('absenceCasesDescription'), absenceSince: translate('absenceSince'), absenceDays: translate('absenceDays'), openAbsenceDossier: translate('openAbsenceDossier'), noActiveAbsences: translate('noActiveAbsences'), absenceRecovery: translate('absenceRecovery'), absenceMore: translate('absenceMore'), openAbsenceOverview: translate('openAbsenceOverview'), leaveTitle: translate('leaveTitle'), leaveToday: translate('leaveToday'), leaveTomorrow: translate('leaveTomorrow'), leavePersons: translate('leavePersons'), leavePerson: translate('leavePerson'), leaveNoAbsences: translate('leaveNoAbsences'), openCalendar: translate('openCalendar'), eventsTitle: translate('eventsTitle'), eventsToday: translate('eventsToday'), eventsTomorrow: translate('eventsTomorrow'), eventsNoEvents: translate('eventsNoEvents'), openAllEvents: translate('openAllEvents'), eventBirthday: translate('eventBirthday'), eventAnniversary: translate('eventAnniversary'), eventStarter: translate('eventStarter'), eventYears: translate('eventYears'), kpiEmployees: translate('kpiEmployees'), kpiRecurringAbsence: translate('kpiRecurringAbsence'), kpiLongTermSick: translate('kpiLongTermSick'), openEmployees: translate('openEmployees'), teamAvailabilityTitle: translate('teamAvailabilityTitle'), teamAvailabilityDescription: translate('teamAvailabilityDescription'), teamAvailabilityPeople: translate('teamAvailabilityPeople'), teamAvailabilityPresence: translate('teamAvailabilityPresence'), teamAvailabilityHours: translate('teamAvailabilityHours'), teamAvailabilityModeLabel: translate('teamAvailabilityModeLabel'), teamAvailabilityAvailable: translate('teamAvailabilityAvailable'), teamAvailabilityNotAvailable: translate('teamAvailabilityNotAvailable'), teamAvailabilityOff: translate('teamAvailabilityOff'), teamAvailabilityLeave: translate('teamAvailabilityLeave'), teamAvailabilityAbsent: translate('teamAvailabilityAbsent'), teamAvailabilityNoMembers: translate('teamAvailabilityNoMembers'), teamAvailabilityHoursUnit: translate('teamAvailabilityHoursUnit'), continuousAppraisalTitle: translate('continuousAppraisalTitle'), continuousAppraisalDescription: translate('continuousAppraisalDescription'), openContinuousAppraisal: translate('openContinuousAppraisal'), openManagerAppraisal: translate('openManagerAppraisal'), appraisalLatest: translate('appraisalLatest'), appraisalOpenActions: translate('appraisalOpenActions'), appraisalNoItems: translate('appraisalNoItems'), layoutLabel: translate('layoutLabel'), full: translate('full'), compact: translate('compact'), fullDescription: translate('fullDescription'), compactDescription: translate('compactDescription'), layoutSaving: translate('layoutSaving'), layoutSaved: translate('layoutSaved'), layoutFailed: translate('layoutFailed'), moveUp: translate('moveUp'), moveDown: translate('moveDown'), drag: translate('drag') }} />
}
