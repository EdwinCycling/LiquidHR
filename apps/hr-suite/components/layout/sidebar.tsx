'use client'

import Link from 'next/link'
import {
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { AdministrationSwitcher } from '@/components/layout/administration-switcher'
import { EmailLink } from '@/components/shared/email-link'
import { Clock } from '@/components/layout/clock'
import { TimeHub, type TimeHubLabels } from '@/components/reminders/time-hub'
import type {
  AdministrationContextOption,
  AdministrationSwitcherMode,
} from '@/lib/context/administration-context'
import type { UserPreferences } from '@/lib/preferences/user-preferences'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'

interface SidebarLabels {
  appName: string
  dashboard: string
  version: string
  organizationChart: string
  employees: string
  settings: string
  personalSettings: string
  hrCalendar: string
  navigation: string
  openMenu: string
  closeMenu: string
  collapse: string
  expand: string
  administration: string
  switchingAdministration: string
  switchAdministrationFailed: string
  timeHub: string
  signOut: string
}

interface SidebarProps {
  email: string
  canReadEmployees: boolean
  canReadSettings: boolean
  canReadHrCalendar: boolean
  tenantName: string
  activeAdministrationId: string | null
  administrations: AdministrationContextOption[]
  administrationSwitcherMode: AdministrationSwitcherMode
  labels: SidebarLabels
  preferences: UserPreferences
  enabledModules: ToggleableModuleCode[]
  reminderLabels: TimeHubLabels
  reminders: ReminderItem[]
  locale: Locale
}

export function Sidebar({
  email,
  canReadEmployees,
  canReadSettings,
  canReadHrCalendar,
  tenantName,
  activeAdministrationId,
  administrations,
  administrationSwitcherMode,
  labels,
  preferences,
  enabledModules,
  reminderLabels,
  reminders,
  locale,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const links = [
    { href: '/dashboard', label: labels.dashboard, icon: LayoutDashboard, visible: true },
    { href: '/employees', label: labels.employees, icon: Users, visible: canReadEmployees },
    { href: '/organization-chart', label: labels.organizationChart, icon: Network, visible: true },
    { href: '/hr-calendar', label: labels.hrCalendar, icon: CalendarRange, visible: canReadHrCalendar },
    { href: '/settings', label: labels.settings, icon: Settings, visible: canReadSettings },
  ]

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-surface px-4 md:hidden">
        <span className="text-sm font-semibold tracking-tight text-primary">{labels.appName}</span>
        <button aria-label={labels.openMenu} className="grid size-10 place-items-center rounded-lg text-foreground hover:bg-muted" onClick={() => setMobileOpen(true)} type="button">
          <Menu aria-hidden="true" size={21} />
        </button>
      </header>

      {mobileOpen ? (
        <button aria-label={labels.closeMenu} className="fixed inset-0 z-40 bg-sidebar/70 md:hidden" onClick={() => setMobileOpen(false)} type="button" />
      ) : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 md:sticky md:top-0 md:z-20 md:min-h-0 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-20' : 'md:w-72'}`}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-semibold">LH</span>
              <span className="truncate text-sm font-semibold tracking-tight">{labels.appName}</span>
            </div>
          ) : (
            <span aria-hidden="true" className="mx-auto grid size-9 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-semibold">LH</span>
          )}
          <button aria-label={labels.closeMenu} className="grid size-9 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden" onClick={() => setMobileOpen(false)} type="button">
            <X aria-hidden="true" size={19} />
          </button>
          <button aria-label={collapsed ? labels.expand : labels.collapse} className="hidden size-9 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:grid" onClick={() => setCollapsed((value) => !value)} type="button">
            {collapsed ? <PanelLeftOpen aria-hidden="true" size={19} /> : <PanelLeftClose aria-hidden="true" size={19} />}
          </button>
        </div>

        {!collapsed ? (
          <div className="px-3 pb-5 pt-4">
            <AdministrationSwitcher
              activeAdministrationId={activeAdministrationId}
              administrations={administrations}
              labels={{
                administration: labels.administration,
                switching: labels.switchingAdministration,
                switchFailed: labels.switchAdministrationFailed,
              }}
              mode={administrationSwitcherMode}
              tenantName={tenantName}
            />
          </div>
        ) : null}

        <nav aria-label={labels.navigation} className="min-h-0 flex-1 overflow-y-auto px-3">
          {links.filter((link) => link.visible).map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            const Icon = link.icon
            return (
              <Link key={link.href} aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
                href={link.href} onClick={() => setMobileOpen(false)} title={collapsed ? link.label : undefined}>
                <Icon aria-hidden="true" className="shrink-0" size={18} />
                {!collapsed ? <span>{link.label}</span> : null}
                {active && !collapsed ? <span aria-hidden="true" className="ml-auto h-4 w-0.5 rounded bg-sidebar-foreground" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className={`shrink-0 border-t border-sidebar-border ${collapsed ? 'p-3' : 'px-4 py-4'}`}>
          <div className={collapsed ? 'grid place-items-center gap-2' : 'flex flex-col gap-4'} title={collapsed ? labels.timeHub : undefined}>
            <Clock mode={preferences.clockMode} style={preferences.analogClockStyle} timeFormat={preferences.timeFormat} />
            {enabledModules.includes('REMINDERS') ? <TimeHub collapsed={collapsed} initialReminders={reminders} labels={reminderLabels} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} /> : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Link aria-current={pathname === '/personal-settings' ? 'page' : undefined} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" href="/personal-settings" onClick={() => setMobileOpen(false)} title={collapsed ? labels.personalSettings : undefined}><Settings aria-hidden="true" className="shrink-0" size={18} />{!collapsed ? <span>{labels.personalSettings}</span> : null}</Link>
          <div className={`mt-2 border-t border-sidebar-border pt-3 ${collapsed ? 'flex justify-center' : ''}`}>
            {!collapsed ? <EmailLink className="block truncate px-3 text-xs text-sidebar-muted hover:text-sidebar-foreground hover:underline" email={email} /> : null}
            <form action="/auth/signout" method="post">
              <button aria-label={labels.signOut} className={`mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? 'justify-center' : 'w-full'}`} title={collapsed ? labels.signOut : undefined} type="submit">
                <LogOut aria-hidden="true" className="shrink-0" size={18} />
                {!collapsed ? <span>{labels.signOut}</span> : null}
              </button>
            </form>
            {!collapsed ? <p className="mt-3 px-3 text-[10px] tabular-nums text-sidebar-muted">{labels.version}</p> : null}
          </div>
        </div>
      </aside>
    </>
  )
}
