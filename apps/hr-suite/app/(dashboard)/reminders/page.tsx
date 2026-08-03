import { ReminderCenter, type ReminderCenterLabels } from '@/components/reminders/reminder-center'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import {
  listManagedReminders,
  listMyReminders,
  listReminderTargetOptions,
  type ManagedReminder,
  type ReminderTargetOptions,
} from '@/lib/reminders/reminder-service'

const EMPTY_TARGETS: ReminderTargetOptions = { departments: [], employees: [] }

export default async function RemindersPage() {
  const [t, reminders, locale, preferences] = await Promise.all([getTranslator('reminders'), listMyReminders(), getLocale(), getUserPreferences()])
  let managed: ManagedReminder[] = []
  let targetOptions = EMPTY_TARGETS
  let canManageHr = true
  try {
    [managed, targetOptions] = await Promise.all([listManagedReminders(), listReminderTargetOptions()])
  } catch (error) {
    if (error instanceof AuthorizationError) canManageHr = false
    else throw error
  }
  const labels: ReminderCenterLabels = {
    personalList: t('personalList'), hrList: t('hrList'), empty: t('empty'), personal: t('personal'), hr: t('hr'),
    newPersonal: t('newPersonal'), newHr: t('newHr'), titleLabel: t('titleLabel'), descriptionLabel: t('descriptionLabel'),
    dateTimeLabel: t('dateTimeLabel'), targetLabel: t('targetLabel'), everyone: t('everyone'), departments: t('departments'),
    employees: t('employees'), create: t('create'), creating: t('creating'), publish: t('publish'), cancelReminder: t('cancelReminder'),
    delete: t('delete'), complete: t('complete'), saveComplete: t('saveComplete'), dismiss: t('dismiss'), snoozeSingular: t('snoozeSingular'), snoozePlural: t('snoozePlural'), saveSnoozeSingular: t('saveSnoozeSingular'), saveSnoozePlural: t('saveSnoozePlural'), decreaseSnoozeDays: t('decreaseSnoozeDays'), increaseSnoozeDays: t('increaseSnoozeDays'), save: t('save'), deactivate: t('deactivate'), deleteConfirm: t('deleteConfirm'), created: t('created'), failed: t('failed'),
    draft: t('draft'), publishedStatus: t('publishedStatus'), cancelled: t('cancelled'), completed: t('completed'), dismissed: t('dismissed'),
    pending: t('pending'), noHrPermission: t('noHrPermission'), filterOpen: t('filterOpen'), filterAll: t('filterAll'), filterCompleted: t('filterCompleted'), filterOverdue: t('filterOverdue'),
    sortSoonest: t('sortSoonest'), sortLatest: t('sortLatest'), sortTitle: t('sortTitle'), search: t('search'), selectAll: t('selectAll'), clearSelection: t('clearSelection'), bulkComplete: t('bulkComplete'), moreInfo: t('moreInfo'), employee: t('employee'), noResults: t('noResults'), selectedCount: t('selectedCount'), visibleCount: t('visibleCount'), close: t('close'), cancel: t('cancel'),
  }
  return <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1><ReminderCenter canManageHr={canManageHr} initialManaged={managed} initialReminders={reminders} labels={labels} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} targetOptions={targetOptions} /></main>
}
