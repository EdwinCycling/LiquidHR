import Link from 'next/link'
import {
  ArrowUpRight,
  Blocks,
  Building2,
  CalendarDays,
  Database,
  FileSliders,
  LayoutDashboard,
  ShieldCheck,
  Star,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeSettingsPlaceholderDialog } from '@/components/settings/employee-settings-placeholder-dialog'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

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

export default async function AdminSettingsPage() {
  try {
    await requirePermission('settings:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [messages, capabilities] = await Promise.all([
    getTranslator('settings'),
    Promise.all([
      allowed('authorization:read'),
      allowed('custom-fields:write'),
      allowed('job-catalog:read'),
      allowed('salary-structure:read'),
      allowed('holidays:read'),
      allowed('modules:read'),
      allowed('department:write'),
      allowed('dashboard-widget:write'),
      allowed('star-performer:read'),
    ]),
  ])

  const [
    authorization,
    customFields,
    jobs,
    salary,
    holidays,
    modules,
    departments,
    dashboardWidgets,
    starPerformers,
  ] = capabilities

  const starTilesVisible = starPerformers
  const sections: Array<{ title: string; items: SettingsTile[] }> = [
    {
      title: messages('admin.sections.organization'),
      items: [
        {
          kind: 'link',
          href: '/settings/star-performer-tags',
          icon: Tags,
          title: messages('admin.tiles.starPerformerTags'),
          description: messages('admin.tiles.starPerformerTagsDescription'),
          visible: starTilesVisible,
        },
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
          href: '/settings/star-performers',
          icon: Star,
          title: messages('admin.tiles.starPerformers'),
          description: messages('admin.tiles.starPerformersDescription'),
          visible: starTilesVisible,
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
          href: '/master-data/jobs',
          icon: Database,
          title: messages('admin.tiles.jobs'),
          description: messages('admin.tiles.jobsDescription'),
          visible: jobs,
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
          href: '/master-data/end-reasons',
          icon: Database,
          title: messages('admin.tiles.endReasons'),
          description: messages('admin.tiles.endReasonsDescription'),
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
      ],
    },
    {
      title: messages('admin.sections.platform'),
      items: [
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

      <div className="space-y-8">
        {sections.map((section) => {
          const items = section.items.filter((item) => item.visible)
          if (!items.length) return null

          return (
            <section key={section.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.title}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            </section>
          )
        })}
      </div>
    </div>
  )
}
