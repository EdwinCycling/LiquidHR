import Link from 'next/link'
import { ArrowUpRight, Blocks, Building2, CalendarDays, Database, FileSliders, ShieldCheck, Users, LayoutDashboard } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

async function allowed(permission: string) {
  try { await requirePermission(permission); return true } catch (error) { if (error instanceof AuthorizationError) return false; throw error }
}

export default async function AdminSettingsPage() {
  try { await requirePermission('settings:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [messages, capabilities] = await Promise.all([
    getTranslator('settings'),
    Promise.all([allowed('authorization:read'), allowed('custom-fields:write'), allowed('job-catalog:read'), allowed('salary-structure:read'), allowed('holidays:read'), allowed('modules:read'), allowed('department:write'), allowed('dashboard-widget:write')]),
  ])
  const [authorization, customFields, jobs, salary, holidays, modules, departments, dashboardWidgets] = capabilities
  const sections = [
    { title: messages('admin.sections.organization'), items: [
      { href: '/authorization', icon: ShieldCheck, title: messages('admin.tiles.authorization'), description: messages('admin.tiles.authorizationDescription'), visible: authorization },
      { href: '/departments', icon: Building2, title: messages('admin.tiles.organization'), description: messages('admin.tiles.organizationDescription'), visible: departments },
      { href: '/employees', icon: Users, title: messages('admin.tiles.employees'), description: messages('admin.tiles.employeesDescription'), visible: true },
      { href: '/custom-fields', icon: FileSliders, title: messages('admin.tiles.customFields'), description: messages('admin.tiles.customFieldsDescription'), visible: customFields },
    ]},
    { title: messages('admin.sections.hrSetup'), items: [
      { href: '/master-data/jobs', icon: Database, title: messages('admin.tiles.jobs'), description: messages('admin.tiles.jobsDescription'), visible: jobs },
      { href: '/master-data/salary-scales', icon: Database, title: messages('admin.tiles.salary'), description: messages('admin.tiles.salaryDescription'), visible: salary },
      { href: '/settings/holidays', icon: CalendarDays, title: messages('admin.tiles.holidays'), description: messages('admin.tiles.holidaysDescription'), visible: holidays },
    ]},
    { title: messages('admin.sections.platform'), items: [
      { href: '/settings/modules', icon: Blocks, title: messages('admin.tiles.modules'), description: messages('admin.tiles.modulesDescription'), visible: modules },
      { href: '/settings/dashboard-widgets', icon: LayoutDashboard, title: messages('admin.tiles.dashboardWidgets'), description: messages('admin.tiles.dashboardWidgetsDescription'), visible: dashboardWidgets },
    ]},
  ]
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><header className="mb-9"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{messages('admin.eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages('admin.title')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{messages('admin.subtitle')}</p></header><div className="space-y-8">{sections.map((section) => { const items = section.items.filter((item) => item.visible); return items.length ? <section key={section.title}><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section.title}</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const Icon = item.icon; return <Link className="group flex min-h-36 items-start gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" href={item.href} key={item.href}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon size={21} /></span><span className="min-w-0"><span className="flex items-center gap-2 font-semibold">{item.title}<ArrowUpRight className="opacity-0 transition group-hover:opacity-100" size={15} /></span><span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.description}</span></span></Link> })}</div></section> : null })}</div></div>
}
