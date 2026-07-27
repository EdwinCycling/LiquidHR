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

  return <StartPage data={data} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} greeting={greeting} labels={{
    eyebrow: translate('eyebrow'), headline: translate('headline'), subtitle: translate('subtitle'), activeScope: translate('activeScope'), administration: translate('administration'), tenant: translate('tenant'), peopleInScope: translate('peopleInScope'), operationalTitle: translate('operationalTitle'), operationalBody: translate('operationalBody'), liveSource: translate('liveSource'), employeesTitle: translate('employeesTitle'), employeesDescription: translate('employeesDescription'), organizationTitle: translate('organizationTitle'), organizationDescription: translate('organizationDescription'), absenceTitle: translate('absenceTitle'), absenceDescription: translate('absenceDescription'), documentsTitle: translate('documentsTitle'), documentsDescription: translate('documentsDescription'), openEmployees: translate('openEmployees'), openOrganization: translate('openOrganization'), openAbsence: translate('openAbsence'), openDocuments: translate('openDocuments'), notAvailable: translate('notAvailable'), yourPriorities: translate('yourPriorities'), prioritiesBody: translate('prioritiesBody'), remindersTitle: translate('remindersTitle'), remindersDescription: translate('remindersDescription'), openReminders: translate('openReminders'), noReminders: translate('noReminders'), moreReminders: translate('moreReminders'), workInProgress: translate('workInProgress'), workInProgressBody: translate('workInProgressBody'), futureDeclarations: translate('futureDeclarations'), futureContracts: translate('futureContracts'), futureAssets: translate('futureAssets'), futureTasks: translate('futureTasks'), futureEvents: translate('futureEvents'), futureSource: translate('futureSource'), dashboardHint: translate('dashboardHint'), openDashboard: translate('openDashboard'), quickLinks: translate('quickLinks'), calendar: translate('calendar'), insights: translate('insights'), updated: translate('updated'), fallbackName: translate('fallbackName'), absenceCasesTitle: translate('absenceCasesTitle'), absenceCasesDescription: translate('absenceCasesDescription'), absenceSince: translate('absenceSince'), absenceDays: translate('absenceDays'), openAbsenceDossier: translate('openAbsenceDossier'), noActiveAbsences: translate('noActiveAbsences'), absenceRecovery: translate('absenceRecovery') }} />
}
