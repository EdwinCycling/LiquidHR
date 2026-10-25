import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { WorkCalendarSettings } from '@/components/settings/work-calendar-settings'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { workCalendarErrorKeys, workCalendarLabelKeys, type WorkCalendarLabels } from '@/lib/work-calendars/labels'
import { getWorkCalendars, WorkCalendarError } from '@/lib/work-calendars/service'

export default async function WorkCalendarsPage() {
  try { await requirePermission('process-definition:write') } catch(error) { if(error instanceof AuthorizationError) redirect('/geen-toegang');throw error }
  const modelPromise=getWorkCalendars().catch(error=>{if(!(error instanceof WorkCalendarError) || error.status!==503)throw error;return undefined})
  const [t,locale,{activeContext,context},model] = await Promise.all([getTranslator('settings'),getLocale(),getRequestAuthorizationContext(),modelPromise])
  const labels: WorkCalendarLabels = {
    ...Object.fromEntries(workCalendarLabelKeys.map(key=>[key,t(`workCalendars.${key}`)])) as Record<typeof workCalendarLabelKeys[number],string>,
    days:Array.from({length:7},(_,index)=>t(`workCalendars.days.${index+1}`)),
    errors:Object.fromEntries(workCalendarErrorKeys.map(key=>[key,t(`workCalendars.errors.${key}`)])),
  }
  return <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
    <AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('admin.title')} title={labels.title} subtitle={labels.subtitle}/>
    {model ? <WorkCalendarSettings initial={model} groupName={activeContext.activeHrGroup.name} administrationId={context.administrationId} administrationName={activeContext.activeAdministration?.name ?? null} timeZone={activeContext.activeHrGroup.timeZone} labels={labels} locale={locale}/>:<p role="status" className="mt-6 text-sm text-muted-foreground">{labels.unavailable}</p>}
  </main>
}
