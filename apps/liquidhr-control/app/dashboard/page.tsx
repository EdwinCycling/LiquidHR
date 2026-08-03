import Link from 'next/link'
import { Building2, Database, PauseCircle, Plus, Search, Users, UserRoundCheck } from 'lucide-react'
import { MetricCard } from '@/components/control/metric-card'
import { StatusBadge } from '@/components/control/status-badge'
import { formatBytes, formatDate } from '@/lib/control/format'
import { getControlSnapshot } from '@/lib/control/service'
import { getDictionary } from '@/lib/i18n/dictionary'
import type { TenantLifecycleStatus } from '@/lib/control/lifecycle'

interface DashboardProps { searchParams: Promise<{ q?: string; status?: string }> }

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const [snapshot, params] = await Promise.all([getControlSnapshot(), searchParams])
  const dictionary = getDictionary()
  const query = (params.q ?? '').trim().toLowerCase()
  const validStatuses = ['PROVISIONING', 'ACTIVE', 'PAUSED', 'TERMINATING', 'TERMINATED']
  const status = validStatuses.includes(params.status ?? '') ? params.status as TenantLifecycleStatus : null
  const tenants = snapshot.tenants.filter((tenant) => (!query || tenant.name.toLowerCase().includes(query) || tenant.slug.includes(query)) && (!status || tenant.lifecycleStatus === status))

  return <div className="enter px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
    <header className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-success">{dictionary.dashboard.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.055em] sm:text-5xl">{dictionary.dashboard.title.replace('{name}', snapshot.operator.displayName.split(' ')[0] ?? snapshot.operator.displayName)}</h1>
        <p className="mt-3 text-muted-foreground">{dictionary.dashboard.subtitle}</p>
      </div>
      {snapshot.operator.role !== 'AUDITOR' ? <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-primary shadow-sm transition-colors hover:bg-accent/80" href="/dashboard/tenants/new"><Plus size={18} />{dictionary.dashboard.newTenant}</Link> : null}
    </header>

    <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={Building2} label={dictionary.dashboard.tenants} tone="accent" value={snapshot.totals.tenants} />
      <MetricCard icon={UserRoundCheck} label={dictionary.dashboard.active} value={snapshot.totals.active} />
      <MetricCard icon={PauseCircle} label={dictionary.dashboard.paused} value={snapshot.totals.paused} />
      <MetricCard icon={Users} label={dictionary.dashboard.employees} value={snapshot.totals.employees} />
      <MetricCard icon={Database} label={dictionary.dashboard.storage} value={formatBytes(snapshot.totals.storageBytes)} />
    </section>

    <section className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-panel" id="klanten">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">{dictionary.dashboard.portfolio}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{dictionary.dashboard.portfolioHint}</p>
          </div>
          <form className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">{dictionary.dashboard.searchLabel}</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input className="h-10 rounded-lg border border-border bg-panel-soft pl-9 pr-3 text-sm outline-none focus:border-primary" defaultValue={params.q} name="q" placeholder={dictionary.dashboard.searchPlaceholder} />
            </label>
            <label>
              <span className="sr-only">{dictionary.dashboard.statusLabel}</span>
              <select className="h-10 rounded-lg border border-border bg-panel-soft px-3 text-sm" defaultValue={status ?? ''} name="status"><option value="">{dictionary.dashboard.allStatuses}</option>{validStatuses.map((value) => <option key={value} value={value}>{dictionary.status[value as TenantLifecycleStatus]}</option>)}</select>
            </label>
          </form>
        </div>
        <div className="divide-y divide-border">
          {tenants.map((tenant) => <Link className="grid gap-4 p-5 transition-colors hover:bg-panel-soft md:grid-cols-[minmax(0,1fr)_150px_120px_130px] md:items-center" href={`/dashboard/tenants/${tenant.id}`} key={tenant.id}>
            <div>
              <div className="flex flex-wrap items-center gap-3"><h3 className="font-bold">{tenant.name}</h3><StatusBadge status={tenant.lifecycleStatus} /></div>
              <p className="mt-1 text-sm text-muted-foreground">{dictionary.dashboard.technicalName}: {tenant.slug} · {tenant.administrationCount} {dictionary.tenant.administrations.toLowerCase()}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">{dictionary.tenant.employees}</p><p className="mt-1 font-bold">{tenant.employeeCount}</p></div>
            <div><p className="text-xs text-muted-foreground">{dictionary.tenant.users}</p><p className="mt-1 font-bold">{tenant.userCount}</p></div>
            <span className="text-sm font-bold text-success">{dictionary.dashboard.open} →</span>
          </Link>)}
        </div>
      </div>
      <aside className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="text-xl font-bold">{dictionary.dashboard.recentChanges}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.dashboard.recentChangesHint}</p>
        <div className="mt-5 space-y-5">{snapshot.audit.length === 0 ? <p className="rounded-xl bg-panel-soft p-4 text-sm text-muted-foreground">{dictionary.dashboard.noAudit}</p> : snapshot.audit.slice(0, 8).map((entry) => <div className="border-l-2 border-accent pl-4" key={entry.id}><p className="text-sm font-bold">{entry.tenantName ?? entry.action}</p><p className="mt-1 text-xs text-muted-foreground">{entry.reason ?? entry.action}</p><p className="mt-2 text-[11px] text-muted-foreground">{entry.actorName} · {formatDate(entry.createdAt)}</p></div>)}</div>
      </aside>
    </section>
  </div>
}
