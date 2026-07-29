import { redirect } from 'next/navigation'
import { StartPage } from '@/components/startpage/start-page'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import { getStartPageData } from '@/lib/startpage/service'

export default async function StartPageRoute() {
  const data = await getStartPageData()
  if (data.isEmployeeOnly && data.employeeId) redirect(`/employees/${data.employeeId}`)

  const [locale, preferences, translate] = await Promise.all([
    getLocale(),
    getUserPreferences(),
    getTranslator('startpage'),
  ])
  const hour = new Date().getHours()
  const greeting = hour < 12 ? translate('goodMorning') : hour < 18 ? translate('goodAfternoon') : translate('goodEvening')

  return <StartPage data={data} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} logoUrl={preferences.companyBranding?.logoUrl} greeting={greeting} labels={{
    eyebrow: translate('eyebrow'), headline: translate('headline'), subtitle: translate('subtitle'), activeScope: translate('activeScope'), administration: translate('administration'), tenant: translate('tenant'), peopleInScope: translate('peopleInScope'), operationalTitle: translate('operationalTitle'), liveSource: translate('liveSource'), documentsTitle: translate('documentsTitle'), documentsDescription: translate('documentsDescription'), openDocuments: translate('openDocuments'), notAvailable: translate('notAvailable'), yourPriorities: translate('yourPriorities'), prioritiesBody: translate('prioritiesBody'), remindersTitle: translate('remindersTitle'), remindersDescription: translate('remindersDescription'), openReminders: translate('openReminders'), noReminders: translate('noReminders'), moreReminders: translate('moreReminders'), workInProgress: translate('workInProgress'), workInProgressBody: translate('workInProgressBody'), futureDeclarations: translate('futureDeclarations'), futureContracts: translate('futureContracts'), futureAssets: translate('futureAssets'), futureTasks: translate('futureTasks'), futureEvents: translate('futureEvents'), futureSource: translate('futureSource'), dashboardHint: translate('dashboardHint'), openDashboard: translate('openDashboard'), quickLinks: translate('quickLinks'), calendar: translate('calendar'), insights: translate('insights'), updated: translate('updated'), fallbackName: translate('fallbackName'), absenceCasesTitle: translate('absenceCasesTitle'), absenceCasesDescription: translate('absenceCasesDescription'), absenceSince: translate('absenceSince'), absenceDays: translate('absenceDays'), openAbsenceDossier: translate('openAbsenceDossier'), noActiveAbsences: translate('noActiveAbsences'), absenceRecovery: translate('absenceRecovery'), absenceMore: translate('absenceMore'), openAbsenceOverview: translate('openAbsenceOverview'), leaveTitle: translate('leaveTitle'), leaveToday: translate('leaveToday'), leaveTomorrow: translate('leaveTomorrow'), leavePersons: translate('leavePersons'), leavePerson: translate('leavePerson'), leaveNoAbsences: translate('leaveNoAbsences'), openCalendar: translate('openCalendar'), eventsTitle: translate('eventsTitle'), eventsToday: translate('eventsToday'), eventsTomorrow: translate('eventsTomorrow'), eventsNoEvents: translate('eventsNoEvents'), openAllEvents: translate('openAllEvents'), eventBirthday: translate('eventBirthday'), eventAnniversary: translate('eventAnniversary'), eventStarter: translate('eventStarter'), eventYears: translate('eventYears'), kpiEmployees: translate('kpiEmployees'), kpiRecurringAbsence: translate('kpiRecurringAbsence'), kpiLongTermSick: translate('kpiLongTermSick'), openEmployees: translate('openEmployees') }} />
}
