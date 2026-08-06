import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Database, RefreshCcw, Users, UserRoundCheck } from 'lucide-react'
import { captureUsage } from '@/lib/control/actions'
import { formatBytes, formatDate } from '@/lib/control/format'
import { getControlSnapshot, getPlatformHrGroups } from '@/lib/control/service'
import { getDictionary } from '@/lib/i18n/dictionary'
import { StatusBadge } from '@/components/control/status-badge'
import { LifecycleForm } from '@/components/control/lifecycle-form'
import { SupportSessionForm } from '@/components/control/support-session-form'
import { HrGroupManager } from '@/components/control/hr-group-manager'

interface TenantPageProps { params: Promise<{ tenantId: string }>; searchParams: Promise<{ error?: string }> }

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams])
  const [snapshot, hrGroups] = await Promise.all([getControlSnapshot(tenantId), getPlatformHrGroups(tenantId)])
  const tenant = snapshot.tenants[0]
  if (!tenant) notFound()
  const dictionary = getDictionary()
  const metrics = [
    { label: dictionary.tenant.administrations, value: tenant.administrationCount, icon: Building2 },
    { label: dictionary.tenant.employees, value: tenant.employeeCount, icon: Users },
    { label: dictionary.tenant.employments, value: tenant.activeEmploymentCount, icon: UserRoundCheck },
    { label: dictionary.tenant.storage, value: formatBytes(tenant.storageBytes), icon: Database },
  ]

  return <div className="enter px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground" href="/dashboard"><ArrowLeft size={16} />{dictionary.tenant.back}</Link>
    <header className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-bold tracking-[-0.055em] sm:text-5xl">{tenant.name}</h1><StatusBadge status={tenant.lifecycleStatus} /></div>
        <p className="mt-3 text-muted-foreground">{dictionary.tenant.technicalName}: {tenant.slug} · {tenant.primaryContactEmail ?? dictionary.common.notSet}</p>
      </div>
      {snapshot.operator.role !== 'AUDITOR' ? <form action={captureUsage}><input name="tenantId" type="hidden" value={tenant.id} /><button className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-sm font-bold" type="submit"><RefreshCcw size={16} />{dictionary.tenant.capture}</button></form> : null}
    </header>
    <p className="mt-5 rounded-xl border border-border bg-panel-soft p-4 text-sm leading-6 text-muted-foreground"><span className="font-bold text-foreground">{dictionary.tenant.viewMode}:</span> {dictionary.tenant.viewModeHint}</p>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <article className="rounded-2xl border border-border bg-panel p-5" key={label}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-muted-foreground">{label}</p><Icon className="text-muted-foreground" size={18} /></div><p className="metric-number mt-5 text-4xl font-bold">{value}</p></article>)}</section>
    <HrGroupManager canWrite={snapshot.operator.role !== 'AUDITOR'} groups={hrGroups} tenantId={tenant.id} />
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-2xl border border-border bg-panel p-6">
        <h2 className="text-xl font-bold">{dictionary.tenant.audit}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.tenant.auditHint}</p>
        <div className="mt-5 divide-y divide-border">{snapshot.audit.length === 0 ? <p className="rounded-xl bg-panel-soft p-4 text-sm text-muted-foreground">{dictionary.tenant.noAudit}</p> : snapshot.audit.map((entry) => <article className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={entry.id}><div><p className="font-bold">{entry.action}</p><p className="mt-1 text-sm text-muted-foreground">{entry.reason ?? dictionary.common.unknown}</p></div><p className="text-xs text-muted-foreground">{entry.actorName}<br />{formatDate(entry.createdAt)}</p></article>)}</div>
      </div>
      <aside className="space-y-6">
        <div className="rounded-2xl border border-border bg-panel p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{dictionary.tenant.mode}</p><p className="mt-3 text-lg font-bold">{tenant.administrationMode === 'COMBINED' ? dictionary.tenant.combined : dictionary.tenant.separate}</p><p className="mt-3 text-sm text-muted-foreground">{dictionary.tenant.updated}: {formatDate(tenant.updatedAt)}</p></div>
        {snapshot.operator.role !== 'AUDITOR' ? <div className="rounded-2xl border border-border bg-panel p-6"><h2 className="text-xl font-bold">{dictionary.tenant.supportTitle}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.tenant.supportHint}</p><SupportSessionForm tenantId={tenant.id} /></div> : null}
        {snapshot.operator.role !== 'AUDITOR' ? <div className="rounded-2xl border border-border bg-panel p-6"><h2 className="text-xl font-bold">{dictionary.tenant.lifecycle}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.tenant.lifecycleHint}</p>{query.error ? <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger" role="alert">{query.error === 'invalid' ? dictionary.tenant.errorInvalid : dictionary.tenant.errorFailed}</p> : null}<LifecycleForm status={tenant.lifecycleStatus} tenantId={tenant.id} /></div> : null}
      </aside>
    </section>
  </div>
}
