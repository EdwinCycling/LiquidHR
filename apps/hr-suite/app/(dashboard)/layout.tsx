import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { AuthenticationError, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { INSIGHT_REPORTS } from '@/lib/insights/report-catalog'
import { ContextAccessError } from '@/lib/context/administration-context'
import { getHrGroupSwitcherMode } from '@/lib/context/administration-context'
import { getTranslator } from '@/lib/i18n/server'
import { APP_VERSION } from '@/lib/app-version'
import { getRequestUserPreferences } from '@/lib/preferences/server'
import { listMyReminders } from '@/lib/reminders/reminder-service'
import { getEnabledTenantModules } from '@/lib/modules/module-service'
import { HeRaFloating } from '@/components/hera/hera-floating'
import { createHeRaLabels } from '@/lib/hera/labels'
import { getProductUpdateDashboardData } from '@/lib/product-updates/service'
import { ProductUpdateBanner, ProductUpdateLoginPopup } from '@/components/product-updates/product-update-surfaces'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { TEST_ROLE_SWITCH_TARGETS, isTestRoleSwitchAccount, isTestRoleSwitchEnabled } from '@/lib/auth/test-role-switch'
import type { TestRoleSwitchOption } from '@/components/layout/test-role-switcher'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let requestContext
  try {
    requestContext = await getRequestAuthorizationContext()
  } catch (error) {
    if (error instanceof ContextAccessError) redirect('/geen-toegang')
    if (error instanceof AuthenticationError) redirect('/login')
    throw error
  }

  const { supabase, context: authContext, activeContext: context, email } = requestContext
  const canReadEmployees = authContext.permissions.includes('employee:read') || authContext.permissions.includes('employee-directory:read')
  const canReadDashboard = authContext.permissions.includes('dashboard:read')
  const canReadStartPage = authContext.permissions.includes('start-page:read')
  const canReadWorkforce = authContext.permissions.includes('workforce:read') || (
    authContext.employeeId !== null
    && (authContext.permissions.includes('self:continuous-appraisal:read') || authContext.permissions.includes('self:talent:read'))
  )
  const canReadProcessWork = authContext.permissions.includes('process-task:read')
    || authContext.permissions.includes('self:process-task:read')
    || authContext.permissions.includes('process-instance:read')
    || authContext.permissions.includes('self:process-instance:read')
  const canReadOrganizationChart = authContext.permissions.includes('organization-chart:read')
    || (authContext.employeeId !== null && authContext.permissions.includes('self:employee:read'))
  const canReadHrCalendar = authContext.permissions.includes('hr-calendar:read')
  const canReadSettings = authContext.permissions.includes('settings:read')
  const insightPermissions = INSIGHT_REPORTS.map((report) => authContext.permissions.includes(report.permission))

  const [preferences, common, navigation, auth, reminderMessages, productUpdateMessages, reminders, enabledModules, productUpdates, profile] = await Promise.all([
    getRequestUserPreferences(),
    getTranslator('common'),
    getTranslator('navigation'),
    getTranslator('auth'),
    getTranslator('reminders'),
    getTranslator('productUpdates'),
    listMyReminders(20, { context: authContext, supabase }).catch(() => []),
    getEnabledTenantModules({ auth: authContext, supabase }),
    getProductUpdateDashboardData({ context: authContext, supabase }),
    authContext.employeeId
      ? supabase.from('employees').select('first_name, avatar_url').eq('id', authContext.employeeId).eq('tenant_id', context.tenant.id).eq('hr_group_id', authContext.hrGroupId ?? '').is('deleted_at', null).maybeSingle().then(({ data: employee }) => employee)
      : Promise.resolve(null),
  ])
  const profileFirstName = profile?.first_name?.trim() || (typeof email === 'string' ? email.split('@')[0] : '') || common('appName')
  const profileAvatarUrl = authContext.employeeId ? employeeAvatarHref(authContext.employeeId, profile?.avatar_url ?? null) : null
  const currentEmail = typeof email === 'string' ? email.trim().toLowerCase() : null
  const testRoleSwitchOptions: TestRoleSwitchOption[] = [
    { key: TEST_ROLE_SWITCH_TARGETS[0].key, email: TEST_ROLE_SWITCH_TARGETS[0].email, label: navigation('testRoleSwitchEdwin') },
    { key: TEST_ROLE_SWITCH_TARGETS[1].key, email: TEST_ROLE_SWITCH_TARGETS[1].email, label: navigation('testRoleSwitchHrAdmin') },
    { key: TEST_ROLE_SWITCH_TARGETS[2].key, email: TEST_ROLE_SWITCH_TARGETS[2].email, label: navigation('testRoleSwitchManager') },
    { key: TEST_ROLE_SWITCH_TARGETS[3].key, email: TEST_ROLE_SWITCH_TARGETS[3].email, label: navigation('testRoleSwitchEmployee') },
  ]
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
        activeHrGroupId={context.activeHrGroup.id}
        hrGroups={context.hrGroups}
        hrGroupSwitcherMode={getHrGroupSwitcherMode(context)}
        canReadEmployees={canReadEmployees}
        canReadDashboard={canReadDashboard}
        canReadStartPage={canReadStartPage}
        canReadWorkforce={canReadWorkforce}
        canReadProcessWork={canReadProcessWork}
        canReadOrganizationChart={canReadOrganizationChart}
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
          work: navigation('work'),
          navigation: navigation('navigation'),
          openMenu: navigation('openMenu'),
          closeMenu: navigation('closeMenu'),
          collapse: navigation('collapse'),
          expand: navigation('expand'),
          hrGroup: navigation('hrGroup'),
          switchingHrGroup: navigation('switchingHrGroup'),
          switchHrGroupFailed: navigation('switchHrGroupFailed'),
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
        testRoleSwitch={{
          currentEmail,
          enabled: isTestRoleSwitchEnabled() && isTestRoleSwitchAccount(currentEmail),
          labels: {
            title: navigation('testRoleSwitchTitle'),
            hint: navigation('testRoleSwitchHint'),
          },
          options: testRoleSwitchOptions,
        }}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-16 md:h-dvh md:pt-0"><ProductUpdateBanner labels={updateSurfaceLabels} updates={productUpdates.bannerUpdates} />{children}</main>
      {enabledModules.includes('HERA') ? <HeRaFloating labels={createHeRaLabels(preferences.locale)} /> : null}
      <ProductUpdateLoginPopup labels={updateSurfaceLabels} locale={preferences.locale} updates={productUpdates.loginPopupUpdates} />
    </div>
  )
}
