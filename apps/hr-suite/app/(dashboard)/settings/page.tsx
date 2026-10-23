import Link from 'next/link'
import {
  Activity,
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
  ListOrdered,
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
  ClipboardCheck,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getEnabledTenantModules } from '@/lib/modules/module-service'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { canUseSetupAssistant as canReadSetupAssistant } from '@/lib/setup-assistant/service'

async function allowed(permission: string) {
  try {
    await requirePermission(permission)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

type SettingsTile = {
  kind: 'link'
  href: string
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
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Link
      className="group flex min-h-36 items-start gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={href}
    >
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">
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
  let settingsAuth: Awaited<ReturnType<typeof requirePermission>>
  try {
    settingsAuth = await requirePermission('settings:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ section }, messages, setupMessages, capabilities, enabledModules] = await Promise.all([
    searchParams,
    getTranslator('settings'),
    getTranslator('setupAssistant'),
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
      allowed('company-document:write'),
      allowed('absence-settings:read'),
      allowed('contract:read'),
      allowed('talent:manage'),
      allowed('hr-group:read'),
      allowed('process-definition:read'),
      allowed('process-operations:read'),
      allowed('research:write'),
      allowed('team-compass:manage'),
      allowed('journey-template:read'),
      allowed('recruitment-settings:manage'),
      allowed('ai:manage'),
      allowed('salary:read'),
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
    companyDocuments,
    absenceSettings,
    employmentContracts,
    talentManage,
    hrGroups,
    processDefinitions,
    processOperationsRead,
    research,
    teamCompassManage,
    journeyTemplateRead,
    recruitmentSettings,
    aiManage,
    payrollFiscalRead,
  ] = capabilities
  const canUseSetupAssistant = canReadSetupAssistant(settingsAuth)
  const payrollFiscalSettings = payrollFiscalRead
    && (settingsAuth.activeRoles.includes('HR_ADMIN') || settingsAuth.activeRoles.includes('TENANT_ADMIN'))

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
          href: '/settings/process-automation/operations',
          icon: Activity,
          title: messages('admin.tiles.processOperations'),
          description: messages('admin.tiles.processOperationsDescription'),
          visible: processOperationsRead,
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
          href: '/settings/recruitment',
          icon: ClipboardCheck,
          title: messages('admin.tiles.recruitment'),
          description: messages('admin.tiles.recruitmentDescription'),
          visible: recruitmentSettings && enabledModules.includes('RECRUITMENT'),
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
          href: '/settings/payroll/fiscal',
          icon: FileSliders,
          title: messages('payrollFiscal.title'),
          description: messages('payrollFiscal.description'),
          visible: payrollFiscalSettings,
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
          href: '/settings/setup-assistant',
          icon: ClipboardCheck,
          title: setupMessages('settingsTileTitle'),
          description: setupMessages('settingsTileDescription'),
          visible: canUseSetupAssistant,
        },
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
          href: '/settings/menu-order',
          icon: ListOrdered,
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
        {
          kind: 'link',
          href: '/settings/ai',
          icon: Sparkles,
          title: messages('admin.tiles.ai'),
          description: messages('admin.tiles.aiDescription'),
          visible: aiManage,
        },
      ],
    },
  ]

  return (
    <PageShell className="py-8 lg:py-10">
      <PageHeader title={messages('admin.title')} />

      <SettingsAccordion initialOpen={section} sections={sections.map((section) => ({ id: section.title === messages('admin.sections.organization') ? 'organization' : section.title === messages('admin.sections.hrSetup') ? 'hrSetup' : 'platform', title: section.title, children: (() => {
          const items = section.items.filter((item) => item.visible)
          if (!items.length) return null

          return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  return (
                    <SettingsLinkTile
                      description={item.description}
                      href={item.href}
                      icon={item.icon}
                      key={item.href}
                      title={item.title}
                    />
                  )
                })}
              </div>
        })() }))} />
    </PageShell>
  )
}
