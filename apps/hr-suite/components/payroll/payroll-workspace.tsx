import Link from 'next/link'
import { ArrowRight, CircleCheck, Link2, ShieldCheck, WalletCards } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { ScrollableTabs, TabLink } from '@/components/patterns/scrollable-tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { PayrollWorkspaceData } from '@/lib/payroll/payroll-service'
import type { Translator } from '@/lib/i18n/translator'

type Labels = {
  eyebrow: string
  title: string
  description: string
  tabs: { overview: string; employees: string; differences: string; settings: string; previous: string; next: string }
  overview: { introTitle: string; introDescription: string; notConnected: string; notConnectedDescription: string; setup: string; provider: string; connectionStatus: string; lastChecked: string; administrations: string; none: string }
  employees: { title: string; description: string; empty: string }
  differences: { title: string; description: string; empty: string }
  settings: { title: string; description: string; providerTitle: string; providerDescription: string; notConnected: string; connect: string; check: string; discover: string; p0Notice: string; credentials: string; bindings: string; noBindings: string; externalCompany: string; liquidAdministration: string; providerFallback: string }
  status: Record<string, string>
}

type View = 'overview' | 'employees' | 'differences' | 'settings'

export function createPayrollLabels(t: Translator): Labels {
  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    description: t('description'),
    tabs: { overview: t('tabs.overview'), employees: t('tabs.employees'), differences: t('tabs.differences'), settings: t('tabs.settings'), previous: t('tabs.previous'), next: t('tabs.next') },
    overview: { introTitle: t('overview.introTitle'), introDescription: t('overview.introDescription'), notConnected: t('overview.notConnected'), notConnectedDescription: t('overview.notConnectedDescription'), setup: t('overview.setup'), provider: t('overview.provider'), connectionStatus: t('overview.connectionStatus'), lastChecked: t('overview.lastChecked'), administrations: t('overview.administrations'), none: t('overview.none') },
    employees: { title: t('employees.title'), description: t('employees.description'), empty: t('employees.empty') },
    differences: { title: t('differences.title'), description: t('differences.description'), empty: t('differences.empty') },
    settings: { title: t('settings.title'), description: t('settings.description'), providerTitle: t('settings.providerTitle'), providerDescription: t('settings.providerDescription'), notConnected: t('settings.notConnected'), connect: t('settings.connect'), check: t('settings.check'), discover: t('settings.discover'), p0Notice: t('settings.p0Notice'), credentials: t('settings.credentials'), bindings: t('settings.bindings'), noBindings: t('settings.noBindings'), externalCompany: t('settings.externalCompany'), liquidAdministration: t('settings.liquidAdministration'), providerFallback: t('settings.providerFallback') },
    status: { NOT_CONNECTED: t('status.NOT_CONNECTED'), CONNECTING: t('status.CONNECTING'), CONNECTED: t('status.CONNECTED'), ACTION_REQUIRED: t('status.ACTION_REQUIRED'), ERROR: t('status.ERROR'), DISCONNECTED: t('status.DISCONNECTED') },
  }
}

function PayrollTabs({ active, labels }: { active: View; labels: Labels }): React.ReactElement {
  const tabs = [
    ['overview', '/payroll', labels.tabs.overview],
    ['employees', '/payroll/employees', labels.tabs.employees],
    ['differences', '/payroll/differences', labels.tabs.differences],
    ['settings', '/payroll/settings', labels.tabs.settings],
  ] as const
  return <ScrollableTabs ariaLabel={labels.title} leftLabel={labels.tabs.previous} rightLabel={labels.tabs.next} contentProps={{ role: 'tablist' }}>{tabs.map(([key, href, label]) => <TabLink active={active === key} href={href} key={key} role="tab">{label}</TabLink>)}</ScrollableTabs>
}

function Overview({ data, labels }: { data: PayrollWorkspaceData; labels: Labels }): React.ReactElement {
  const connection = data.activeConnection
  const provider = connection ? data.providers.find((item) => item.id === connection.providerId) : data.providers[0]
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
    <Surface className="p-6">
      <div className="flex items-start gap-4"><span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><WalletCards size={21} /></span><div><h2 className="text-lg font-semibold">{labels.overview.introTitle}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.overview.introDescription}</p></div></div>
      <div className="mt-7 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-5"><p className="font-semibold">{connection ? provider?.name ?? labels.overview.provider : labels.overview.notConnected}</p><p className="mt-1 text-sm text-muted-foreground">{connection ? labels.status[connection.status] ?? connection.status : labels.overview.notConnectedDescription}</p>{!connection ? <Link className="ui-button ui-button-primary relative mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/payroll/settings">{labels.overview.setup}<ArrowRight aria-hidden="true" size={16} /></Link> : null}</div>
    </Surface>
    <Surface className="p-6"><h2 className="text-base font-semibold">{labels.overview.connectionStatus}</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-muted-foreground">{labels.overview.provider}</dt><dd className="mt-1 font-medium">{provider?.name ?? labels.overview.none}</dd></div><div><dt className="text-muted-foreground">{labels.overview.lastChecked}</dt><dd className="mt-1 font-medium">{connection?.lastCheckedAt ?? labels.overview.none}</dd></div><div><dt className="text-muted-foreground">{labels.overview.administrations}</dt><dd className="mt-1 font-medium">{data.bindings.filter((binding) => binding.status === 'ACTIVE').length}</dd></div></dl></Surface>
  </div>
}

function Placeholder({ title, description, empty, icon }: { title: string; description: string; empty: string; icon: React.ReactNode }): React.ReactElement {
  return <><PageHeader title={title} description={description} /><EmptyState className="mt-6" icon={icon} title={empty} /></>
}

function Settings({ data, labels }: { data: PayrollWorkspaceData; labels: Labels }): React.ReactElement {
  const provider = data.providers[0]
  const status = data.activeConnection ? labels.status[data.activeConnection.status] ?? data.activeConnection.status : labels.settings.notConnected
  return <div className="space-y-5"><PageHeader title={labels.settings.title} description={labels.settings.description} /><Surface className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><h2 className="text-lg font-semibold">{labels.settings.providerTitle}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.settings.providerDescription}</p></div><span className="inline-flex items-center gap-2 text-sm font-medium"><CircleCheck aria-hidden="true" className={data.activeConnection ? 'text-success' : 'text-muted-foreground'} size={17} />{status}</span></div><div className="mt-6 border-t border-subtle pt-5"><p className="font-medium">{provider?.name ?? labels.settings.providerFallback}</p><p className="mt-1 text-sm text-muted-foreground">{labels.settings.p0Notice}</p><div className="mt-5 flex flex-wrap gap-2"><Button disabled variant="primary">{labels.settings.connect}</Button><Button disabled variant="secondary">{labels.settings.check}</Button><Button disabled variant="secondary">{labels.settings.discover}</Button></div></div><div className="mt-5 flex items-start gap-3 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={17} /><span>{labels.settings.credentials}</span></div></Surface><Surface className="p-6"><div className="flex items-center gap-3"><Link2 aria-hidden="true" className="text-primary" size={18} /><h2 className="text-lg font-semibold">{labels.settings.bindings}</h2></div>{data.bindings.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.settings.noBindings}</p> : <ul className="mt-4 space-y-3">{data.bindings.map((binding) => <li className="grid gap-1 border-t border-subtle pt-3 text-sm md:grid-cols-2" key={binding.id}><span><span className="block text-xs text-muted-foreground">{labels.settings.externalCompany}</span>{binding.externalCompanyDisplayName}</span><span><span className="block text-xs text-muted-foreground">{labels.settings.liquidAdministration}</span>{binding.administrationId}</span></li>)}</ul>}</Surface></div>
}

export function PayrollWorkspace({ active, data, labels }: { active: View; data: PayrollWorkspaceData; labels: Labels }): React.ReactElement {
  const content = active === 'overview'
    ? <Overview data={data} labels={labels} />
    : active === 'employees'
      ? <Placeholder description={labels.employees.description} empty={labels.employees.empty} icon={<WalletCards />} title={labels.employees.title} />
      : active === 'differences'
        ? <Placeholder description={labels.differences.description} empty={labels.differences.empty} icon={<ShieldCheck />} title={labels.differences.title} />
        : <Settings data={data} labels={labels} />
  return <PageShell className="py-8 lg:py-10"><PageHeader className="mb-5" description={labels.description} title={labels.title} /><PayrollTabs active={active} labels={labels} /><div className="mt-6">{content}</div></PageShell>
}
