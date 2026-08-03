import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { requireAuthContext } from '@/lib/auth/permissions'
import { INSIGHT_REPORTS } from '@/lib/insights/report-catalog'
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
import { createHeRaLabels } from '@/lib/hera/labels'
import { getProductUpdateDashboardData } from '@/lib/product-updates/service'
import { ProductUpdateBanner, ProductUpdateLoginPopup } from '@/components/product-updates/product-update-surfaces'
import { employeeAvatarHref } from '@/lib/employees/employee-service'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) redirect('/login')

  let context
  try {
    context = await loadActiveContext(data.claims.sub, supabase)
  } catch (error) {
    if (error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }

  const authContext = await requireAuthContext(supabase, context)
  const canReadEmployees = authContext.permissions.includes('employee:read')
  const canReadHrCalendar = authContext.permissions.includes('hr-calendar:read')
  const canReadSettings = authContext.permissions.includes('settings:read')
  const insightPermissions = INSIGHT_REPORTS.map((report) => authContext.permissions.includes(report.permission))

  const [preferences, common, navigation, auth, reminderMessages, productUpdateMessages, reminders, enabledModules, productUpdates, profile] = await Promise.all([
    getUserPreferences({ supabase, userId: data.claims.sub, tenantId: context.tenant.id, administrationId: context.administration?.id ?? null }),
    getTranslator('common'),
    getTranslator('navigation'),
    getTranslator('auth'),
    getTranslator('reminders'),
    getTranslator('productUpdates'),
    listMyReminders(20, { context: authContext, supabase }).catch(() => []),
    getEnabledTenantModules({ auth: authContext, supabase }),
    getProductUpdateDashboardData(),
    authContext.employeeId
      ? supabase.from('employees').select('first_name, avatar_url').eq('id', authContext.employeeId).eq('tenant_id', context.tenant.id).is('deleted_at', null).maybeSingle().then(({ data: employee }) => employee)
      : Promise.resolve(null),
  ])
  const profileFirstName = profile?.first_name?.trim() || (typeof data.claims.email === 'string' ? data.claims.email.split('@')[0] : '') || common('appName')
  const profileAvatarUrl = authContext.employeeId ? employeeAvatarHref(authContext.employeeId, profile?.avatar_url ?? null) : null
  const updateSurfaceLabels = {
    title: productUpdateMessages('title'),
    open: productUpdateMessages('open'),
    close: productUpdateMessages('close'),
    kindNewFeature: productUpdateMessages('kindNewFeature'),
    kindImprovement: productUpdateMessages('kindImprovement'),
    giftWindow: productUpdateMessages('giftWindow'),
    loginPopup: productUpdateMessages('loginPopup'),
    topBanner: productUpdateMessages('topBanner'),
    dateFrom: productUpdateMessages('dateFrom'),
    dateUntil: productUpdateMessages('dateUntil'),
    more: productUpdateMessages('more'),
    manage: productUpdateMessages('manage'),
    seen: productUpdateMessages('seen'),
  }

  return (
    <div className="fixed inset-0 flex h-dvh min-h-0 overflow-hidden bg-background">
      <Sidebar
        activeAdministrationId={context.administration?.id ?? null}
        administrations={context.administrations}
        administrationSwitcherMode={getAdministrationSwitcherMode(context)}
        canReadEmployees={canReadEmployees}
        canReadSettings={canReadSettings}
        canReadHrCalendar={canReadHrCalendar}
        canReadInsights={insightPermissions.some(Boolean)}
        labels={{
          appName: common('appName'),
          dashboard: navigation('dashboard'),
          startPage: navigation('startPage'),
          version: `${common('version')} ${APP_VERSION}`,
          organizationChart: navigation('organizationChart'),
          employees: navigation('employees'),
          settings: navigation('settings'),
          personalSettings: navigation('personalSettings'),
          hrCalendar: navigation('hrCalendar'),
          insights: navigation('insights'),
          workforce: navigation('workforce'),
          navigation: navigation('navigation'),
          openMenu: navigation('openMenu'),
          closeMenu: navigation('closeMenu'),
          collapse: navigation('collapse'),
          expand: navigation('expand'),
          administration: navigation('administration'),
          switchingAdministration: navigation('switchingAdministration'),
          switchAdministrationFailed: navigation('switchAdministrationFailed'),
          timeHub: navigation('timeHub'),
          productUpdates: navigation('productUpdates'),
          signOut: auth('signOut'),
        }}
        preferences={preferences}
        profileFirstName={profileFirstName}
        profileAvatarUrl={profileAvatarUrl}
        locale={preferences.locale}
        reminders={reminders}
        reminderLabels={{
          timeHub: reminderMessages('timeHub'),
          openManagement: reminderMessages('openManagement'),
          pendingCount: reminderMessages('pendingCount', { count: '{count}' }),
          moreReminders: reminderMessages('moreReminders'),
          empty: reminderMessages('empty'),
          nextReminder: reminderMessages('nextReminder'),
          upcomingTitle: reminderMessages('upcomingTitle'),
          overdueTitle: reminderMessages('overdueTitle'),
          noUpcoming: reminderMessages('noUpcoming'),
          noOverdue: reminderMessages('noOverdue'),
          dueTitle: reminderMessages('dueTitle'),
          complete: reminderMessages('complete'),
          saveComplete: reminderMessages('saveComplete'),
          dismiss: reminderMessages('dismiss'),
          snoozeSingular: reminderMessages('snoozeSingular'),
          snoozePlural: reminderMessages('snoozePlural'),
          saveSnoozeSingular: reminderMessages('saveSnoozeSingular'),
          saveSnoozePlural: reminderMessages('saveSnoozePlural'),
          decreaseSnoozeDays: reminderMessages('decreaseSnoozeDays'),
          increaseSnoozeDays: reminderMessages('increaseSnoozeDays'),
          cancel: reminderMessages('cancel'),
          close: reminderMessages('close'),
        }}
        enabledModules={enabledModules}
        productUpdateUnreadCount={productUpdates.unreadGiftCount}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-16 md:h-dvh md:pt-0"><ProductUpdateBanner labels={updateSurfaceLabels} updates={productUpdates.bannerUpdates} />{children}</main>
      {enabledModules.includes('HERA') ? <HeRaFloating labels={createHeRaLabels(preferences.locale)} /> : null}
      <ProductUpdateLoginPopup labels={updateSurfaceLabels} locale={preferences.locale} updates={productUpdates.loginPopupUpdates} />
    </div>
  )
}
