import Link from 'next/link'
import {
  ArrowUpRight,
  Blocks,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Compass,
  HeartPulse,
  Database,
  FileSliders,
  FileText,
  LayoutDashboard,
  MapPinned,
  Palette,
  ShieldCheck,
  Layers3,
  Sparkles,
  Umbrella,
  Users,
  UsersRound,
  Workflow,
  ClipboardList,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeSettingsPlaceholderDialog } from '@/components/settings/employee-settings-placeholder-dialog'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getEnabledTenantModules } from '@/lib/modules/module-service'

async function allowed(permission: string) {
  try {
    await requirePermission(permission)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

type SettingsTile =
  | {
      kind: 'link'
      href: string
      icon: LucideIcon
      title: string
      description: string
      visible: boolean
      pending?: boolean
    }
  | {
      kind: 'modal'
      modal: 'employees'
      icon: LucideIcon
      title: string
      description: string
      visible: boolean
    }

function SettingsLinkTile({
  href,
  icon: Icon,
  title,
  description,
  pending = false,
  pendingLabel,
  pendingDescription,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  pending?: boolean
  pendingLabel: string
  pendingDescription: string
}) {
  if (pending) {
    return (
      <div className="flex min-h-36 items-start gap-4 rounded-2xl border border-dashed bg-surface p-5 shadow-sm">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <Icon size={21} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-semibold">
            {title}
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              {pendingLabel}
            </span>
          </span>
          <span className="mt-2 block text-sm leading-6 text-muted-foreground">
            {description}
          </span>
          <span className="mt-2 block text-xs font-medium text-muted-foreground">
            {pendingDescription}
          </span>
        </span>
      </div>
    )
  }

  return (
    <Link
      className="group flex min-h-36 items-start gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      href={href}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
        <Icon size={21} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-semibold">
          {title}
          <ArrowUpRight className="opacity-0 transition group-hover:opacity-100" size={15} />
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  )
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  try {
    await requirePermission('settings:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ section }, messages, capabilities, enabledModules] = await Promise.all([
    searchParams,
    getTranslator('settings'),
    Promise.all([
      allowed('authorization:read'),
      allowed('custom-fields:write'),
      allowed('job-catalog:read'),
      allowed('salary-structure:read'),
      allowed('holidays:read'),
      allowed('leave:read'),
      allowed('modules:read'),
      allowed('department:write'),
      allowed('company-data:read'),
      allowed('dashboard-widget:write'),
      allowed('company-document:write'),
      allowed('absence-settings:read'),
      allowed('contract:read'),
      allowed('talent:manage'),
      allowed('hr-group:read'),
      allowed('process-definition:read'),
      allowed('research:write'),
      allowed('team-compass:manage'),
      allowed('journey-template:read'),
    ]),
    getEnabledTenantModules(),
  ])

  const [
    authorization,
    customFields,
    jobs,
    salary,
    holidays,
    leave,
    modules,
    departments,
    companyData,
    dashboardWidgets,
    companyDocuments,
    absenceSettings,
    employmentContracts,
    talentManage,
    hrGroups,
    processDefinitions,
    research,
    teamCompassManage,
    journeyTemplateRead,
  ] = capabilities

  const sections: Array<{ title: string; items: SettingsTile[] }> = [
    {
      title: messages('admin.sections.organization'),
      items: [
        {
          kind: 'link',
          href: '/authorization',
          icon: ShieldCheck,
          title: messages('admin.tiles.authorization'),
          description: messages('admin.tiles.authorizationDescription'),
          visible: authorization,
        },
        {
          kind: 'link',
          href: '/role-assignments',
          icon: Users,
          title: messages('admin.tiles.roleAssignments'),
          description: messages('admin.tiles.roleAssignmentsDescription'),
          visible: authorization,
        },
        {
          kind: 'link',
          href: '/departments',
          icon: Building2,
          title: messages('admin.tiles.organization'),
          description: messages('admin.tiles.organizationDescription'),
          visible: departments,
        },
        {
          kind: 'link',
          href: '/settings/company-data',
          icon: MapPinned,
          title: messages('admin.tiles.companyData'),
          description: messages('admin.tiles.companyDataDescription'),
          visible: companyData,
        },
        {
          kind: 'modal',
          modal: 'employees',
          icon: Users,
          title: messages('admin.tiles.employees'),
          description: messages('admin.tiles.employeesDescription'),
          visible: true,
        },
        {
          kind: 'link',
          href: '/custom-fields',
          icon: FileSliders,
          title: messages('admin.tiles.customFields'),
          description: messages('admin.tiles.customFieldsDescription'),
          visible: customFields,
        },
      ],
    },
    {
      title: messages('admin.sections.hrSetup'),
      items: [
        {
          kind: 'link',
          href: '/settings/employment-contracts',
          icon: BriefcaseBusiness,
          title: messages('admin.tiles.employmentContracts'),
          description: messages('admin.tiles.employmentContractsDescription'),
          visible: employmentContracts,
        },
        {
          kind: 'link',
          href: '/settings/employee-directory',
          icon: UsersRound,
          title: messages('admin.tiles.employeeDirectory'),
          description: messages('admin.tiles.employeeDirectoryDescription'),
          visible: true,
        },
        {
          kind: 'link',
          href: '/master-data/jobs',
          icon: Database,
          title: messages('admin.tiles.jobs'),
          description: messages('admin.tiles.jobsDescription'),
          visible: jobs,
        },
        {
          kind: 'link',
          href: '/settings/talent',
          icon: Sparkles,
          title: messages('admin.tiles.talentFoundation'),
          description: messages('admin.tiles.talentFoundationDescription'),
          visible: talentManage,
        },
        {
          kind: 'link',
          href: '/settings/process-automation',
          icon: Workflow,
          title: messages('admin.tiles.processAutomation'),
          description: messages('admin.tiles.processAutomationDescription'),
          visible: processDefinitions,
        },
        {
          kind: 'link',
          href: '/settings/research',
          icon: ClipboardList,
          title: messages('admin.tiles.research'),
          description: messages('admin.tiles.researchDescription'),
          visible: research,
        },
        {
          kind: 'link',
          href: '/settings/team-compass',
          icon: Compass,
          title: messages('admin.tiles.teamCompass'),
          description: messages('admin.tiles.teamCompassDescription'),
          visible: teamCompassManage,
        },
        {
          kind: 'link',
          href: '/settings/journeys',
          icon: Route,
          title: messages('admin.tiles.journeys'),
          description: messages('admin.tiles.journeysDescription'),
          visible: journeyTemplateRead && enabledModules.includes('JOURNEYS'),
        },
        {
          kind: 'link',
          href: '/master-data/salary-scales',
          icon: Database,
          title: messages('admin.tiles.salary'),
          description: messages('admin.tiles.salaryDescription'),
          visible: salary,
        },
        {
          kind: 'link',
          href: '/master-data',
          icon: Database,
          title: messages('admin.tiles.masterData'),
          description: messages('admin.tiles.masterDataDescription'),
          visible: jobs,
        },
        {
          kind: 'link',
          href: '/settings/holidays',
          icon: CalendarDays,
          title: messages('admin.tiles.holidays'),
          description: messages('admin.tiles.holidaysDescription'),
          visible: holidays,
        },
        {
          kind: 'link',
          href: '/settings/leave-accrual',
          icon: Umbrella,
          title: messages('admin.tiles.leave'),
          description: messages('admin.tiles.leaveDescription'),
          visible: leave,
        },
        {
          kind: 'link',
          href: '/settings/absence',
          icon: HeartPulse,
          title: messages('admin.tiles.absence'),
          description: messages('admin.tiles.absenceDescription'),
          visible: absenceSettings,
        },
        {
          kind: 'link',
          href: '/settings/anniversary-rules',
          icon: CalendarDays,
          title: messages('admin.tiles.anniversaryRules'),
          description: messages('admin.tiles.anniversaryRulesDescription'),
          visible: true,
        },
        {
          kind: 'link',
          href: '/company-documents',
          icon: FileText,
          title: messages('admin.tiles.companyDocuments'),
          description: messages('admin.tiles.companyDocumentsDescription'),
          visible: companyDocuments,
        },
      ],
    },
    {
      title: messages('admin.sections.platform'),
      items: [
        {
          kind: 'link',
          href: '/settings/business-structure',
          icon: Layers3,
          title: messages('admin.tiles.administration'),
          description: messages('admin.tiles.administrationDescription'),
          visible: hrGroups,
        },
        {
          kind: 'link',
          href: '/settings/modules',
          icon: Blocks,
          title: messages('admin.tiles.modules'),
          description: messages('admin.tiles.modulesDescription'),
          visible: modules,
        },
        {
          kind: 'link',
          href: '/settings/dashboard-widgets',
          icon: LayoutDashboard,
          title: messages('admin.tiles.dashboardWidgets'),
          description: messages('admin.tiles.dashboardWidgetsDescription'),
          visible: dashboardWidgets,
        },
        {
          kind: 'link',
          href: '/settings/menu-order',
          icon: LayoutDashboard,
          title: messages('admin.menuOrderTitle'),
          description: messages('admin.menuOrderDescription'),
          visible: true,
        },
        {
          kind: 'link',
          href: '/settings/company-branding',
          icon: Palette,
          title: messages('admin.tiles.companyBranding'),
          description: messages('admin.tiles.companyBrandingDescription'),
          visible: true,
        },
      ],
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10">
      <header className="mb-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {messages('admin.eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {messages('admin.title')}
        </h1>
      </header>

      <SettingsAccordion initialOpen={section} sections={sections.map((section) => ({ id: section.title === messages('admin.sections.organization') ? 'organization' : section.title === messages('admin.sections.hrSetup') ? 'hrSetup' : 'platform', title: section.title, children: (() => {
          const items = section.items.filter((item) => item.visible)
          if (!items.length) return null

          return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  if (item.kind === 'modal') {
                    return (
                      <EmployeeSettingsPlaceholderDialog
                        key={item.modal}
                        labels={{
                          tileTitle: item.title,
                          tileDescription: item.description,
                          title: messages('employeeSettings.title'),
                          description: messages('employeeSettings.description'),
                          comingSoon: messages('employeeSettings.comingSoon'),
                          close: messages('employeeSettings.close'),
                        }}
                      />
                    )
                  }

                  return (
                    <SettingsLinkTile
                      description={item.description}
                      href={item.href}
                      icon={item.icon}
                      key={item.href}
                      pending={item.pending}
                      pendingDescription={messages('admin.tiles.pendingActivationDescription')}
                      pendingLabel={messages('admin.tiles.pendingActivation')}
                      title={item.title}
                    />
                  )
                })}
              </div>
        })() }))} />
    </div>
  )
}
