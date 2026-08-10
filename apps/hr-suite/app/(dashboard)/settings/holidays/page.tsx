import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { HolidaySettings } from '@/components/settings/holiday-settings'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { listHolidays } from '@/lib/holidays/holiday-service'
import { listCompanyActivities } from '@/lib/company-activities/service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function HolidaySettingsPage() {
  try { await requirePermission('holidays:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const year = new Date().getFullYear()
  const [holidays, activities, locale, t] = await Promise.all([listHolidays(year), listCompanyActivities(year), getLocale(), getTranslator('settings')])
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('admin.title')} subtitle={t('holidays.subtitle')} title={t('holidays.title')} /><HolidaySettings initial={holidays} initialActivities={activities} initialYear={year} labels={{ year:t('holidays.year'), country:t('holidays.country'), countrySearch:t('holidays.countrySearch'), countryEmpty:t('holidays.countryEmpty'), preview:t('holidays.preview'), import:t('holidays.import'), imported:t('holidays.imported'), providerFailed:t('holidays.providerFailed'), localTitle:t('holidays.localTitle'), localName:t('holidays.localName'), date:t('holidays.date'), add:t('holidays.add'), calendarTitle:t('holidays.calendarTitle'), empty:t('holidays.empty'), api:t('holidays.api'), manual:t('holidays.manual'), included:t('holidays.included'), excluded:t('holidays.excluded'), activate:t('holidays.activate'), deactivate:t('holidays.deactivate'), saving:t('saving'), activityTitle:t('holidays.activityTitle'), activityName:t('holidays.activityName'), activityEmpty:t('holidays.activityEmpty'), activityAdd:t('holidays.activityAdd'), activityAdded:t('holidays.activityAdded'), activityEdit:t('holidays.activityEdit'), activitySave:t('holidays.activitySave'), activityUpdated:t('holidays.activityUpdated'), activityDuplicate:t('holidays.activityDuplicate'), activated:t('holidays.activated'), deactivated:t('holidays.deactivated'), failed:t('holidays.failed'), cancel:t('holidays.cancel'), close:t('holidays.close'), activityActive:t('holidays.activityActive'), activityInactive:t('holidays.activityInactive') }} locale={locale} /></div>
}
