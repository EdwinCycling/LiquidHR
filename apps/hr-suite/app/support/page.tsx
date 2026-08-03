import { AlertTriangle, Building2, Clock3, Eye, ShieldCheck, Users, UserRoundCheck } from 'lucide-react'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { endSupportSession } from '@/lib/support/actions'
import { getSupportReadModel } from '@/lib/support/service'

function formatSupportDate(value: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(value))
}

export default async function SupportPage() {
  const locale = await getLocale()
  const t = await getTranslator('support', locale)
  const model = await getSupportReadModel()
  const controlAppOrigin = (process.env.NEXT_PUBLIC_CONTROL_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')

  if (!model) {
    return <main className="min-h-dvh bg-background px-5 py-10 sm:px-8 lg:px-12 lg:py-16"><section className="mx-auto max-w-2xl rounded-3xl border border-border bg-panel p-8 shadow-sm sm:p-12"><div className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger"><AlertTriangle size={24} /></div><p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-danger">{t('expiredEyebrow')}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{t('expiredTitle')}</h1><p className="mt-4 text-base leading-7 text-muted-foreground">{t('expiredBody')}</p><a className="mt-8 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground" href={`${controlAppOrigin}/dashboard`}>{t('backToControl')}</a></section></main>
  }

  const roleLabel = model.operator.role === 'OWNER' ? t('roleOwner') : t('roleOperator')
  const modeLabel = model.tenant.administrationMode === 'COMBINED' ? t('modeCombined') : t('modeSeparate')
  const metrics = [
    { label: t('administrations'), value: model.summary.administrationCount, icon: Building2 },
    { label: t('employees'), value: model.summary.employeeCount, icon: Users },
    { label: t('activeEmployments'), value: model.summary.activeEmploymentCount, icon: UserRoundCheck },
  ]

  return <main className="min-h-dvh bg-background px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
    <div className="mx-auto max-w-7xl">
      <header className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary"><ShieldCheck size={14} />{t('readOnly')}</span><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/65">{t('eyebrow')}</p></div><h1 className="mt-5 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">{t('title', { tenant: model.tenant.name })}</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-primary-foreground/75">{t('banner')}</p></div>
          <form action={endSupportSession}><button className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-primary" type="submit"><Eye size={16} />{t('stop')}</button></form>
        </div>
        <div className="mt-8 grid gap-3 border-t border-primary-foreground/15 pt-5 text-sm text-primary-foreground/75 sm:grid-cols-2"><p className="flex items-center gap-2"><ShieldCheck size={16} />{t('operator')}: <span className="font-bold text-primary-foreground">{model.operator.displayName}</span> ({roleLabel})</p><p className="flex items-center gap-2 sm:justify-end"><Clock3 size={16} />{t('expiresAt', { date: formatSupportDate(model.expiresAt, locale) })}</p></div>
      </header>

      <section aria-labelledby="support-summary" className="mt-6"><h2 className="sr-only" id="support-summary">{t('summary')}</h2><div className="grid gap-4 md:grid-cols-3">{metrics.map(({ label, value, icon: Icon }) => <article className="rounded-2xl border border-border bg-panel p-5" key={label}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-muted-foreground">{label}</p><Icon className="text-muted-foreground" size={18} /></div><p className="metric-number mt-5 text-4xl font-bold">{value}</p></article>)}</div></section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-border bg-panel p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">{t('employeeList')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('noActions')}</p></div><div className="rounded-xl bg-panel-soft px-3 py-2 text-sm font-semibold text-muted-foreground">{t('tenantMode')}: <span className="text-foreground">{modeLabel}</span></div></div>{model.employeeListTruncated ? <p className="mt-5 rounded-xl bg-warning-soft p-3 text-sm leading-6 text-warning-foreground">{t('truncated')}</p> : null}<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-3 font-bold">{t('employeeNumber')}</th><th className="px-3 py-3 font-bold">{t('name')}</th></tr></thead><tbody className="divide-y divide-border">{model.employees.map((employee) => <tr key={employee.id}><td className="px-3 py-3 font-mono text-xs text-muted-foreground">{employee.employeeNumber}</td><td className="px-3 py-3 font-semibold">{employee.firstName} {employee.lastName}</td></tr>)}</tbody></table>{model.employees.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{t('noEmployees')}</p> : null}</div></div>
        <aside className="rounded-2xl border border-border bg-panel p-6"><h2 className="text-xl font-bold">{t('administrationList')}</h2><div className="mt-5 divide-y divide-border">{model.administrations.map((administration) => <article className="py-4 first:pt-0 last:pb-0" key={administration.id}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{administration.name}</p><p className="mt-1 text-xs font-mono text-muted-foreground">{t('code')}: {administration.code}</p></div><span className="rounded-full bg-panel-soft px-2.5 py-1 text-xs font-bold text-muted-foreground">{administration.isActive ? t('active') : t('inactive')}</span></div></article>)}</div>{model.administrations.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t('noAdministrations')}</p> : null}</aside>
      </section>
    </div>
  </main>
}
