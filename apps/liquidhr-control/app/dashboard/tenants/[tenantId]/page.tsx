import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Database, History, LifeBuoy, RefreshCcw, Settings2, UserRoundCheck, Users } from 'lucide-react'
import { captureUsage } from '@/lib/control/actions'
import { formatBytes, formatDate } from '@/lib/control/format'
import { getControlSnapshot, getPlatformHrGroups } from '@/lib/control/service'
import { getDictionary } from '@/lib/i18n/dictionary'
import { StatusBadge } from '@/components/control/status-badge'
import { LifecycleForm } from '@/components/control/lifecycle-form'
import { SupportSessionForm } from '@/components/control/support-session-form'
import { HrGroupManager } from '@/components/control/hr-group-manager'
import { FirstAdminBootstrapForm } from '@/components/control/first-admin-bootstrap-form'
import { PageShell } from '@/components/ui/page-shell'
import { buttonClasses } from '@/components/ui/button'
import { TenantPageAccordion, type TenantPageAccordionSection } from '@/components/control/tenant-page-accordion'

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
  const sections: TenantPageAccordionSection[] = [
    {
      id: 'overview',
      title: dictionary.tenant.overviewTitle,
      description: dictionary.tenant.overviewHint,
      icon: <Building2 aria-hidden="true" size={18} />,
      children: (
        <div>
          <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">{dictionary.tenant.viewMode}:</span> {dictionary.tenant.viewModeHint}</p>
          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dictionary.tenant.technicalName}</dt><dd className="mt-1 break-all text-sm font-medium">{tenant.slug}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dictionary.tenant.contact}</dt><dd className="mt-1 break-all text-sm font-medium">{tenant.primaryContactEmail ?? dictionary.common.notSet}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dictionary.tenant.mode}</dt><dd className="mt-1 text-sm font-medium">{tenant.administrationMode === 'COMBINED' ? dictionary.tenant.combined : dictionary.tenant.separate}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dictionary.tenant.updated}</dt><dd className="mt-1 text-sm font-medium">{formatDate(tenant.updatedAt)}</dd></div>
          </dl>
          <dl className="mt-5 grid gap-x-6 border-t border-border sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => <div className="flex items-start gap-3 border-b border-border py-4 last:border-b-0 sm:border-b-0" key={label}><Icon aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground" size={17} /><div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="metric-number mt-1 text-2xl font-semibold">{value}</dd></div></div>)}
          </dl>
          {snapshot.operator.role !== 'AUDITOR' ? <form action={captureUsage} className="mt-4"><input name="tenantId" type="hidden" value={tenant.id} /><button className={buttonClasses({ variant: 'secondary' })} type="submit"><RefreshCcw aria-hidden="true" size={16} />{dictionary.tenant.capture}</button></form> : null}
        </div>
      ),
    },
    {
      id: 'groups',
      title: dictionary.tenant.hrGroups,
      description: dictionary.tenant.hrGroupsHint,
      icon: <Users aria-hidden="true" size={18} />,
      badge: hrGroups.length,
      children: <HrGroupManager canWrite={snapshot.operator.role !== 'AUDITOR'} groups={hrGroups} tenantId={tenant.id} />,
    },
    ...(snapshot.operator.role !== 'AUDITOR' && tenant.lifecycleStatus === 'PROVISIONING' ? [{
      id: 'bootstrap',
      title: dictionary.tenant.bootstrapTitle,
      description: dictionary.tenant.bootstrapHint,
      icon: <UserRoundCheck aria-hidden="true" size={18} />,
      children: <FirstAdminBootstrapForm groups={hrGroups} tenantId={tenant.id} />,
    }] : []),
    {
      id: 'audit',
      title: dictionary.tenant.audit,
      description: dictionary.tenant.auditHint,
      icon: <History aria-hidden="true" size={18} />,
      badge: snapshot.audit.length,
      children: snapshot.audit.length === 0
        ? <p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{dictionary.tenant.noAudit}</p>
        : <div className="divide-y divide-border">{snapshot.audit.map((entry) => <article className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]" key={entry.id}><div><p className="font-medium">{entry.action}</p><p className="mt-1 text-sm text-muted-foreground">{entry.reason ?? dictionary.common.unknown}</p></div><p className="text-xs text-muted-foreground">{entry.actorName}<br />{formatDate(entry.createdAt)}</p></article>)}</div>,
    },
    ...(snapshot.operator.role !== 'AUDITOR' ? [{
      id: 'support',
      title: dictionary.tenant.supportTitle,
      description: dictionary.tenant.supportHint,
      icon: <LifeBuoy aria-hidden="true" size={18} />,
      children: <SupportSessionForm tenantId={tenant.id} />,
    }, {
      id: 'lifecycle',
      title: dictionary.tenant.lifecycle,
      description: dictionary.tenant.lifecycleHint,
      icon: <Settings2 aria-hidden="true" size={18} />,
      children: <>{query.error ? <p className="mb-4 rounded-[var(--radius-control)] bg-destructive-subtle p-3 text-sm text-destructive" role="alert">{query.error === 'invalid' ? dictionary.tenant.errorInvalid : dictionary.tenant.errorFailed}</p> : null}<LifecycleForm status={tenant.lifecycleStatus} tenantId={tenant.id} /></>,
    }] : []),
  ]

  return <PageShell className="enter">
    <Link className={buttonClasses({ variant: 'secondary' })} href="/dashboard#klanten"><ArrowLeft aria-hidden="true" size={16} />{dictionary.tenant.back}</Link>
    <header className="mt-6 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
      <div className="min-w-0"><p className="eyebrow">{dictionary.tenant.customerPageEyebrow}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{tenant.name}</h1><StatusBadge status={tenant.lifecycleStatus} /></div></div>
    </header>
    <TenantPageAccordion initialOpen="groups" sections={sections} />
  </PageShell>
}
