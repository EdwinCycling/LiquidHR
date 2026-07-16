import { DashboardWorkspace } from '@/components/dashboard/dashboard-workspace'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import messagesEn from '@/messages/en/dashboard.json'
import messagesNl from '@/messages/nl/dashboard.json'

export default async function DashboardPage() {
  const locale = await getLocale()
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  return <DashboardWorkspace labels={{
    title: translate('title'), new: translate('new'), edit: translate('edit'), save: translate('save'), cancel: translate('cancel'),
    addWidget: translate('addWidget'), removeWidget: translate('removeWidget'), moveUp: translate('moveUp'), moveDown: translate('moveDown'),
    rename: translate('rename'), duplicate: translate('duplicate'), delete: translate('delete'), welcome: translate('welcome'), welcomeBody: translate('welcomeBody'),
    myReminders: translate('myReminders'), organization: translate('organization'), employees: translate('employees'), openReminders: translate('openReminders'),
    openOrganization: translate('openOrganization'), openEmployees: translate('openEmployees'), empty: translate('empty'), error: translate('error'), dashboardName: translate('dashboardName'), create: translate('create'),
  }} />
}
