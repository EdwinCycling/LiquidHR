import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import type { SettingsModalLabels } from '@/components/layout/settings-modal'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { getAdministrationSwitcherMode } from '@/lib/context/administration-context'
import { loadActiveContext } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { APP_VERSION } from '@/lib/app-version'
import { getUserPreferences } from '@/lib/preferences/server'
import { createClient } from '@/lib/supabase/server'
import { listMyReminders } from '@/lib/reminders/reminder-service'

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
  const [canReadDepartments, canReadEmployees, canReadOrganizationChart, canReadAuthorization, canManageCustomFields] = await Promise.all([
    can('department:read'), can('employee:read'), can('organization-chart:read'), can('authorization:read'), can('custom-fields:write'),
  ])

  const [preferences, common, navigation, settings, auth, reminderMessages, reminders] = await Promise.all([
    getUserPreferences(),
    getTranslator('common'),
    getTranslator('navigation'),
    getTranslator('settings'),
    getTranslator('auth'),
    getTranslator('reminders'),
    listMyReminders(20).catch(() => []),
  ])
  const settingsLabels: SettingsModalLabels = {
    open: settings('open'),
    close: settings('close'),
    title: settings('title'),
    subtitle: settings('subtitle'),
    language: settings('language'),
    languageHelp: settings('languageHelp'),
    dutch: settings('dutch'),
    english: settings('english'),
    theme: settings('theme'),
    themeHelp: settings('themeHelp'),
    clock: settings('clock'),
    clockHelp: settings('clockHelp'),
    analog: settings('analog'),
    digital: settings('digital'),
    hidden: settings('hidden'),
    clockStyle: settings('clockStyle'),
    classic: settings('classic'),
    minimal: settings('minimal'),
    liquid: settings('liquid'),
    appearanceTab: settings('appearanceTab'),
    timeHubTab: settings('timeHubTab'),
    clockPreview: settings('clockPreview'),
    save: common('save'),
    cancel: common('cancel'),
    saving: settings('saving'),
    saved: settings('saved'),
    saveFailed: settings('saveFailed'),
    invalid: settings('invalid'),
    unauthenticated: settings('unauthenticated'),
    themes: {
      'liquid-navy': {
        name: settings('themes.liquid-navy'),
        description: settings('themeDescriptions.liquid-navy'),
      },
      noordzee: {
        name: settings('themes.noordzee'),
        description: settings('themeDescriptions.noordzee'),
      },
      bos: {
        name: settings('themes.bos'),
        description: settings('themeDescriptions.bos'),
      },
      'warm-zand': {
        name: settings('themes.warm-zand'),
        description: settings('themeDescriptions.warm-zand'),
      },
      aubergine: {
        name: settings('themes.aubergine'),
        description: settings('themeDescriptions.aubergine'),
      },
      nacht: {
        name: settings('themes.nacht'),
        description: settings('themeDescriptions.nacht'),
      },
    },
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeAdministrationId={context.administration?.id ?? null}
        administrations={context.administrations}
        administrationSwitcherMode={getAdministrationSwitcherMode(context)}
        canReadDepartments={canReadDepartments}
        canReadEmployees={canReadEmployees}
        canReadOrganizationChart={canReadOrganizationChart}
        canReadAuthorization={canReadAuthorization}
        canManageCustomFields={canManageCustomFields}
        email={email}
        labels={{
          appName: common('appName'),
          version: `${common('version')} ${APP_VERSION}`,
          hera: navigation('hera'),
          departments: navigation('departments'),
          organizationChart: navigation('organizationChart'),
          employees: navigation('employees'),
          authorization: navigation('authorization'),
          customFields: navigation('customFields'),
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
          openAll: reminderMessages('openAll'),
          pendingCount: reminderMessages('pendingCount', { count: '{count}' }),
          empty: reminderMessages('empty'),
          dueTitle: reminderMessages('dueTitle'),
          complete: reminderMessages('complete'),
          dismiss: reminderMessages('dismiss'),
          snooze: reminderMessages('snooze'),
          close: reminderMessages('close'),
        }}
        settingsLabels={settingsLabels}
        tenantName={context.tenant.name}
      />
      <main className="min-w-0 flex-1 overflow-auto pt-16 md:pt-0">{children}</main>
    </div>
  )
}
