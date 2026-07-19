import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { getAdministrationSwitcherMode } from '@/lib/context/administration-context'
import { loadActiveContext } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { APP_VERSION } from '@/lib/app-version'
import { getUserPreferences } from '@/lib/preferences/server'
import { createClient } from '@/lib/supabase/server'
import { listMyReminders } from '@/lib/reminders/reminder-service'
import { getEnabledTenantModules } from '@/lib/modules/module-service'
import { HeRaFloating } from '@/components/hera/hera-floating'
import { createHeRaLabels } from './hera/page'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : ''

  if (!data?.claims?.sub) redirect('/login')

  let context
  try {
    context = await loadActiveContext(data.claims.sub)
  } catch (error) {
    if (error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }

  async function can(permission: string): Promise<boolean> {
    try { await requirePermission(permission); return true }
    catch (error) { if (error instanceof AuthorizationError) return false; throw error }
  }
  const [canReadEmployees, canReadHrCalendar, canReadSettings] = await Promise.all([
    can('employee:read'), can('hr-calendar:read'), can('settings:read'),
  ])

  const [preferences, common, navigation, auth, reminderMessages, reminders, enabledModules] = await Promise.all([
    getUserPreferences(),
    getTranslator('common'),
    getTranslator('navigation'),
    getTranslator('auth'),
    getTranslator('reminders'),
    listMyReminders(20).catch(() => []),
    getEnabledTenantModules(),
  ])

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <Sidebar
        activeAdministrationId={context.administration?.id ?? null}
        administrations={context.administrations}
        administrationSwitcherMode={getAdministrationSwitcherMode(context)}
        canReadEmployees={canReadEmployees}
        canReadSettings={canReadSettings}
        canReadHrCalendar={canReadHrCalendar}
        email={email}
        labels={{
          appName: common('appName'),
          dashboard: navigation('dashboard'),
          version: `${common('version')} ${APP_VERSION}`,
          organizationChart: navigation('organizationChart'),
          employees: navigation('employees'),
          settings: navigation('settings'),
          personalSettings: navigation('personalSettings'),
          hrCalendar: navigation('hrCalendar'),
          navigation: navigation('navigation'),
          openMenu: navigation('openMenu'),
          closeMenu: navigation('closeMenu'),
          collapse: navigation('collapse'),
          expand: navigation('expand'),
          administration: navigation('administration'),
          switchingAdministration: navigation('switchingAdministration'),
          switchAdministrationFailed: navigation('switchAdministrationFailed'),
          timeHub: navigation('timeHub'),
          signOut: auth('signOut'),
        }}
        preferences={preferences}
        locale={preferences.locale}
        reminders={reminders}
        reminderLabels={{
          timeHub: reminderMessages('timeHub'),
          openManagement: reminderMessages('openManagement'),
          pendingCount: reminderMessages('pendingCount', { count: '{count}' }),
          empty: reminderMessages('empty'),
          dueTitle: reminderMessages('dueTitle'),
          complete: reminderMessages('complete'),
          dismiss: reminderMessages('dismiss'),
          snooze: reminderMessages('snooze'),
          close: reminderMessages('close'),
        }}
        enabledModules={enabledModules}
        tenantName={context.tenant.name}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-16 md:h-dvh md:pt-0">{children}</main>
      {enabledModules.includes('HERA') ? <HeRaFloating labels={createHeRaLabels(preferences.locale)} /> : null}
    </div>
  )
}
