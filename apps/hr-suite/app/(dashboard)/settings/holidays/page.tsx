import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { HolidaySettings } from '@/components/settings/holiday-settings'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { listHolidays } from '@/lib/holidays/holiday-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function HolidaySettingsPage() { try { await requirePermission('holidays:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error } const year = new Date().getFullYear(); const [holidays, t] = await Promise.all([listHolidays(year), getTranslator('settings')]); return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('admin.title')} subtitle={t('holidays.subtitle')} title={t('holidays.title')} /><HolidaySettings initial={holidays} initialYear={year} labels={{ year:t('holidays.year'), country:t('holidays.country'), preview:t('holidays.preview'), import:t('holidays.import'), imported:t('holidays.imported'), providerFailed:t('holidays.providerFailed'), localTitle:t('holidays.localTitle'), localName:t('holidays.localName'), date:t('holidays.date'), add:t('holidays.add'), calendarTitle:t('holidays.calendarTitle'), empty:t('holidays.empty'), api:t('holidays.api'), manual:t('holidays.manual'), included:t('holidays.included'), excluded:t('holidays.excluded'), saving:t('saving') }} /></div> }
