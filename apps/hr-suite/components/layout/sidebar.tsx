/* eslint-disable @next/next/no-img-element -- the private administration logo is served by an authenticated route. */
'use client'

import Link from 'next/link'
import {
  CalendarRange,
  ChartColumn,
  ChevronDown,
  House,
  ListTodo,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Route,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HrGroupSwitcher } from '@/components/layout/hr-group-switcher'
import { Clock } from '@/components/layout/clock'
import { TestRoleSwitcher, type TestRoleSwitchOption } from '@/components/layout/test-role-switcher'
import { TimeHub, type TimeHubLabels } from '@/components/reminders/time-hub'
import { ProductUpdateDrawerTrigger, type ProductUpdateSurfaceLabels } from '@/components/product-updates/product-update-surfaces'
import type { ProductUpdate } from '@/lib/product-updates/service'
import { buildSidebarSections, normalizeSidebarMenuOrder } from '@/components/layout/sidebar-navigation'
import type {
  HrGroupContextOption,
  HrGroupSwitcherMode,
} from '@/lib/context/administration-context'
import type { UserPreferences } from '@/lib/preferences/user-preferences'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'

interface SidebarLabels {
  appName: string
  startPage: string
  version: string
  organizationChart: string
  employees: string
  settings: string
  personalSettings: string
  hrCalendar: string
  insights: string
  workforce: string
  work: string
  research: string
  recruitment: string
  journeys: string
  documentStudio: string
  navigation: string
  openMenu: string
  closeMenu: string
  collapse: string
  expand: string
  hrGroup: string
  switchingHrGroup: string
  switchHrGroupFailed: string
  timeHub: string
  sectionDaily: string
  sectionPeopleOrganization: string
  sectionHrProcesses: string
  sectionSteering: string
  sectionManagement: string
  signOut: string
}

interface SidebarProps {
  canReadEmployees: boolean
  canReadStartPage: boolean
  canReadWorkforce: boolean
  canReadProcessWork: boolean
  canReadOrganizationChart: boolean
  canReadSettings: boolean
  canReadHrCalendar: boolean
  canReadInsights: boolean
  canOpenResearch: boolean
  canReadRecruitment: boolean
  canReadJourneys: boolean
  canReadDocumentStudio: boolean
  labels: SidebarLabels
  preferences: UserPreferences
  profileFirstName: string
  profileAvatarUrl: string | null
  enabledModules: ToggleableModuleCode[]
  reminderLabels: TimeHubLabels
  reminders: ReminderItem[]
  locale: Locale
  productUpdateUnreadCount: number
  productUpdates: ProductUpdate[]
  productUpdateLabels: ProductUpdateSurfaceLabels
  activeHrGroupId: string
  hrGroups: HrGroupContextOption[]
  hrGroupSwitcherMode: HrGroupSwitcherMode
  testRoleSwitch: {
    enabled: boolean
    currentEmail: string | null
    options: TestRoleSwitchOption[]
    labels: {
      title: string
      hint: string
    }
  }
}

export function Sidebar({
  canReadEmployees,
  canReadStartPage,
  canReadWorkforce,
  canReadProcessWork,
  canReadOrganizationChart,
  canReadSettings,
  canReadHrCalendar,
  canReadInsights,
  canOpenResearch,
  canReadRecruitment,
  canReadJourneys,
  canReadDocumentStudio,
  labels,
  preferences,
  profileFirstName,
  profileAvatarUrl,
  enabledModules,
  reminderLabels,
  reminders,
  locale,
  productUpdateUnreadCount,
  productUpdates,
  productUpdateLabels,
  activeHrGroupId,
  hrGroups,
  hrGroupSwitcherMode,
  testRoleSwitch,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOrder, setMenuOrder] = useState<string[]>([])
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const [currentProductUpdateUnreadCount, setCurrentProductUpdateUnreadCount] = useState(productUpdateUnreadCount)
  const links = [
    { href: '/dashboard/start', label: labels.startPage, icon: House, visible: canReadStartPage },
    { href: '/work', label: labels.work, icon: ListTodo, visible: canReadProcessWork },
    { href: '/hr-calendar', label: labels.hrCalendar, icon: CalendarRange, visible: canReadHrCalendar },
    { href: '/employees', label: labels.employees, icon: Users, visible: canReadEmployees },
    { href: '/organization-chart', label: labels.organizationChart, icon: Network, visible: canReadOrganizationChart },
    { href: '/workforce', label: labels.workforce, icon: BriefcaseBusiness, visible: canReadWorkforce },
    { href: '/recruitment', label: labels.recruitment, icon: ClipboardCheck, visible: canReadRecruitment },
    { href: '/journeys', label: labels.journeys, icon: Route, visible: canReadJourneys },
    { href: '/document-studio', label: labels.documentStudio, icon: FileStack, visible: canReadDocumentStudio },
    { href: '/research', label: labels.research, icon: ClipboardList, visible: canOpenResearch },
    { href: '/insights', label: labels.insights, icon: ChartColumn, visible: canReadInsights },
    { href: '/settings', label: labels.settings, icon: Settings, visible: canReadSettings, exact: true },
  ]
  useEffect(() => {
    const load = () => {
      try {
        const saved = JSON.parse(window.localStorage.getItem('liquidhr.sidebar-menu-order') ?? '[]')
        if (!Array.isArray(saved)) return
        setMenuOrder(normalizeSidebarMenuOrder(saved))
      } catch { setMenuOrder([]) }
    }
    const handleChange = (event: Event) => { const detail = (event as CustomEvent<string[]>).detail; if (Array.isArray(detail)) setMenuOrder(normalizeSidebarMenuOrder(detail)) }
    const handleProductUpdatesSeen = () => setCurrentProductUpdateUnreadCount(0)
    load(); window.addEventListener('liquidhr-menu-order-changed', handleChange); window.addEventListener('liquidhr-product-updates-seen', handleProductUpdatesSeen); return () => { window.removeEventListener('liquidhr-menu-order-changed', handleChange); window.removeEventListener('liquidhr-product-updates-seen', handleProductUpdatesSeen) }
  }, [canOpenResearch, canReadDocumentStudio, canReadJourneys, canReadProcessWork, canReadRecruitment, canReadStartPage, canReadWorkforce])
  useEffect(() => {
    if (!accountMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !accountMenuRef.current?.contains(target)) setAccountMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])
  const sidebarSections = buildSidebarSections(links, {
    daily: labels.sectionDaily,
    peopleOrganization: labels.sectionPeopleOrganization,
    hrProcesses: labels.sectionHrProcesses,
    steering: labels.sectionSteering,
    management: labels.sectionManagement,
  }, menuOrder)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-surface px-4 md:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-primary">{preferences.companyBranding?.logoUrl ? <img alt="" className="max-h-8 max-w-28 object-contain" src={preferences.companyBranding.logoUrl} /> : null}{labels.appName}</span>
        <button aria-label={labels.openMenu} className="grid size-10 place-items-center rounded-lg text-foreground hover:bg-muted" onClick={() => setMobileOpen(true)} type="button">
          <Menu aria-hidden="true" size={21} />
        </button>
      </header>

      {mobileOpen ? (
        <button aria-label={labels.closeMenu} className="fixed inset-0 z-40 bg-sidebar/70 md:hidden" onClick={() => setMobileOpen(false)} type="button" />
      ) : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 md:sticky md:top-0 md:z-20 md:min-h-0 md:translate-x-0 md:overflow-visible ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-20' : 'md:w-72'}`}>
        <div className={`flex min-h-16 items-center gap-2 border-b border-sidebar-border ${collapsed ? 'justify-center px-2' : 'px-3'}`}>
          {!collapsed ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {preferences.companyBranding?.logoUrl ? <img alt="" className="max-h-9 max-w-32 shrink-0 object-contain" src={preferences.companyBranding.logoUrl} /> : <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-semibold">LH</span>}
              <span className="truncate text-sm font-semibold tracking-tight">{labels.appName}</span>
            </div>
          ) : null}
          <div className={`relative flex shrink-0 items-center gap-0.5 ${collapsed ? 'flex-col gap-1' : ''}`}>
            <ProductUpdateDrawerTrigger collapsed={collapsed} labels={productUpdateLabels} locale={locale} onClose={() => setMobileOpen(false)} unreadCount={currentProductUpdateUnreadCount} updates={productUpdates} />
            {testRoleSwitch.enabled && testRoleSwitch.currentEmail ? <TestRoleSwitcher collapsed={collapsed} currentEmail={testRoleSwitch.currentEmail} labels={testRoleSwitch.labels} options={testRoleSwitch.options} /> : null}
            <button aria-label={labels.closeMenu} className="grid size-9 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden" onClick={() => setMobileOpen(false)} type="button">
              <X aria-hidden="true" size={19} />
            </button>
            <button aria-label={collapsed ? labels.expand : labels.collapse} className="hidden size-11 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:grid" onClick={() => { setAccountMenuOpen(false); setCollapsed((value) => !value) }} type="button">
              {collapsed ? <PanelLeftOpen aria-hidden="true" size={19} /> : <PanelLeftClose aria-hidden="true" size={19} />}
            </button>
          </div>
        </div>

        {!collapsed && hrGroupSwitcherMode === 'SELECT' ? (
          <div className="px-3 pb-3 pt-3">
            <HrGroupSwitcher
              activeHrGroupId={activeHrGroupId}
              hrGroups={hrGroups}
              labels={{
                hrGroup: labels.hrGroup,
                switching: labels.switchingHrGroup,
                switchFailed: labels.switchHrGroupFailed,
              }}
              mode={hrGroupSwitcherMode}
            />
          </div>
        ) : null}

        <nav aria-label={labels.navigation} className="min-h-0 flex-1 overflow-y-auto px-3">
          <div className="space-y-3 py-3">
            {sidebarSections.map((section) => (
              <section aria-labelledby={!collapsed ? `sidebar-section-${section.id}` : undefined} key={section.id}>
                {!collapsed ? <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/75" id={`sidebar-section-${section.id}`}>{section.label}</h2> : null}
                <div className="space-y-0.5">
                  {section.items.map((link) => {
                    const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)
                    const Icon = link.icon
                    return (
                      <Link key={link.href} aria-current={active ? 'page' : undefined}
                         className={`group flex min-h-10 items-center gap-3 rounded-lg text-sm transition-colors ${collapsed ? 'mx-auto size-11 justify-center p-0' : 'px-3 py-2'} ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
                        href={link.href} onClick={() => setMobileOpen(false)} title={collapsed ? link.label : undefined}>
                        <Icon aria-hidden="true" className="shrink-0" size={18} />
                        {!collapsed ? <span>{link.label}</span> : null}
                        {active && !collapsed ? <span aria-hidden="true" className="ml-auto h-4 w-0.5 rounded bg-sidebar-foreground" /> : null}
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <div className={`flex shrink-0 items-center border-t border-sidebar-border ${collapsed ? 'justify-center px-2 py-2' : 'justify-between gap-2 px-3 py-2'}`}>
          {!collapsed ? <div className="min-w-0 max-md:hidden"><Clock mode={preferences.clockMode} style={preferences.analogClockStyle} timeFormat={preferences.timeFormat} /></div> : null}
          {enabledModules.includes('REMINDERS') ? <TimeHub collapsed={collapsed} compact initialReminders={reminders} labels={reminderLabels} locale={locale} dateFormat={preferences.dateFormat} timeFormat={preferences.timeFormat} /> : null}
        </div>

        <div className={`relative shrink-0 border-t border-sidebar-border ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`} ref={accountMenuRef}>
          {accountMenuOpen ? <div aria-label={profileFirstName} className={`absolute z-30 rounded-xl border border-sidebar-border bg-sidebar p-2 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--sidebar)_45%,transparent)] ${collapsed ? 'bottom-0 left-[calc(100%+0.75rem)] w-64' : 'bottom-[calc(100%+0.5rem)] left-0 right-0'}`} id="sidebar-account-menu" role="menu">
            <Link aria-current={pathname === '/personal-settings' ? 'page' : undefined} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal leading-5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" href="/personal-settings" onClick={() => { setAccountMenuOpen(false); setMobileOpen(false) }} role="menuitem"><Settings aria-hidden="true" className="shrink-0" size={18} /><span>{labels.personalSettings}</span></Link>
            <form action="/auth/signout" method="post">
              <button aria-label={labels.signOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal leading-5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" role="menuitem" type="submit"><LogOut aria-hidden="true" className="shrink-0" size={18} /><span>{labels.signOut}</span></button>
            </form>
            <p className="mt-2 border-t border-sidebar-border px-3 pt-2 text-xs font-normal leading-5 text-sidebar-muted/75">{labels.version}</p>
          </div> : null}
          <button aria-controls={accountMenuOpen ? 'sidebar-account-menu' : undefined} aria-expanded={accountMenuOpen} aria-haspopup="menu" aria-label={profileFirstName} className={`flex items-center rounded-lg text-left text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? 'mx-auto size-11 justify-center p-0' : 'w-full gap-3 px-2 py-2'}`} data-testid="account-menu-trigger" onClick={() => setAccountMenuOpen((value) => !value)} ref={accountTriggerRef} title={collapsed ? profileFirstName : undefined} type="button">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-foreground">
              {profileAvatarUrl ? <img alt="" className="size-full object-cover" src={profileAvatarUrl} /> : <UserRound aria-hidden="true" size={17} />}
            </span>
            {!collapsed ? <span className="min-w-0 flex-1 truncate">{profileFirstName}</span> : null}
            {!collapsed ? <ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} size={17} /> : null}
          </button>
        </div>
      </aside>
    </>
  )
}
