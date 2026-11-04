import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import { Button, buttonClasses } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { AuthorizationError } from '@/lib/auth/permissions'
import {
  EmploymentPensionArrangementError,
  getPensionAdministrationSettings,
} from '@/lib/employment/pension-arrangement-service'
import { getTranslator } from '@/lib/i18n/server'
import {
  assignPensionArrangementFromSettingsAction,
  createPensionArrangementSettingsAction,
  createPensionArrangementVersionSettingsAction,
} from './actions'

type PageProps = { searchParams: Promise<{ status?: string }> }

function actualRate(totalRate: number | null, share: number): string {
  if (totalRate === null) return '—'
  return `${(totalRate * share / 100).toFixed(2)}%`
}

function jsonString(value: unknown, key: string, fallback: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'string' ? candidate : fallback
}

export default async function PayrollPensionSettingsPage({ searchParams }: PageProps) {
  const [{ status }, t] = await Promise.all([searchParams, getTranslator('settings')])
  let data: Awaited<ReturnType<typeof getPensionAdministrationSettings>>
  try {
    data = await getPensionAdministrationSettings()
  } catch (error) {
    if (error instanceof AuthorizationError || (error instanceof EmploymentPensionArrangementError && error.status === 403)) redirect('/geen-toegang')
    throw error
  }
  const copy = (key: string, values?: Record<string, string | number>) => t(`payrollPension.${key}`, values)
  const statusMessage = status === 'saved' ? copy('saved')
    : status === 'invalid' ? copy('invalid')
      : status === 'blocked' ? copy('blocked')
        : status === 'unavailable' ? copy('unavailable') : null
  const linkedEmployments = data.employments.filter((employment) => employment.assignment !== null)
  const unlinkedEmployments = data.employments.filter((employment) => employment.assignment === null)
  const activeArrangements = data.arrangements.filter((arrangement) => arrangement.is_active)

  return <PageShell className="space-y-6 py-6 lg:py-9">
    <Link prefetch={false} className="text-sm font-semibold text-primary hover:underline" href="/settings">{copy('backToSettings')}</Link>
    <PageHeader title={copy('title')} description={copy('description')} />
    <p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4 text-sm">{copy('scopeNotice', { administration: data.administration.name })}</p>
    {statusMessage ? <p className={`rounded-[var(--radius-control)] border p-4 text-sm ${status === 'saved' ? 'border-success/30 bg-success-surface text-success' : 'border-warning/40 bg-warning-surface text-warning'}`} role={status === 'saved' ? 'status' : 'alert'}>{statusMessage}</p> : null}

    <Surface className="space-y-4 p-5 sm:p-6">
      <SectionHeader title={copy('createTitle')} description={copy('createDescription')} />
      <form action={createPensionArrangementSettingsAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm font-medium">{copy('code')}<TextInput name="code" maxLength={80} pattern="[A-Z0-9][A-Z0-9_-]{1,79}" placeholder="MARS-PENSION-2026" required /></label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">{copy('name')}<TextInput name="name" maxLength={180} placeholder={copy('namePlaceholder')} required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('effectiveFrom')}<TextInput name="effectiveFrom" type="date" defaultValue="2026-01-01" required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('effectiveTo')}<TextInput name="effectiveTo" type="date" defaultValue="2026-12-31" /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('employeeRate')}<TextInput name="employeeRatePercent" inputMode="decimal" min="0" step="0.01" type="number" defaultValue="10" required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('employerRate')}<TextInput name="employerRatePercent" inputMode="decimal" min="0" step="0.01" type="number" defaultValue="15" required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('annualFranchise')}<TextInput name="annualFranchise" inputMode="decimal" min="0" step="0.01" type="number" defaultValue="19172" required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('annualCap')}<TextInput name="annualPensionableSalaryCap" inputMode="decimal" min="0" step="0.01" type="number" defaultValue="137800" required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('participantGroup')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" defaultValue="NEW_ENTRANT" name="participantGroup"><option value="NEW_ENTRANT">{copy('newEntrant')}</option><option value="GRANDFATHERED">{copy('grandfathered')}</option></select></label>
        <div className="flex items-end md:col-span-2 xl:col-span-3"><Button type="submit">{copy('createAction')}</Button></div>
      </form>
      <p className="border-t border-subtle pt-4 text-sm text-muted-foreground">{copy('provenanceNotice')}</p>
    </Surface>

    <Surface className="space-y-5 p-5 sm:p-6">
      <SectionHeader title={copy('arrangementsTitle')} description={copy('arrangementsDescription')} />
      {data.arrangements.length === 0 ? <p className="rounded-[var(--radius-control)] border border-subtle p-4 text-sm text-muted-foreground">{copy('emptyArrangements')}</p> : <div className="space-y-6">
        {data.arrangements.map((arrangement) => {
          const versions = data.versions.filter((version) => version.pension_arrangement_id === arrangement.id)
          const current = versions.find((version) => version.is_active) ?? versions[0] ?? null
          const totalRate = current?.flat_total_rate ?? arrangement.flat_total_rate
          const employeeShare = current?.employee_share_pct ?? arrangement.employee_share_pct
          const employerShare = current?.employer_share_pct ?? arrangement.employer_share_pct
          const eligibility = current?.eligibility_rule ?? arrangement.eligibility_rule
          return <article className="space-y-4 border-t border-subtle pt-5 first:border-0 first:pt-0" key={arrangement.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{arrangement.name}</h3><p className="text-sm text-muted-foreground">{arrangement.code} · {copy('versionCount', { count: versions.length })}</p></div>
              <span className="rounded-full bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning">{copy('employerProvided')}</span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
              <div><dt className="text-muted-foreground">{copy('validity')}</dt><dd className="font-medium">{arrangement.effective_from} – {arrangement.effective_to ?? copy('openEnded')}</dd></div>
              <div><dt className="text-muted-foreground">{copy('totalRate')}</dt><dd className="font-medium">{totalRate === null ? '—' : `${totalRate.toFixed(2)}%`}</dd></div>
              <div><dt className="text-muted-foreground">{copy('employeeRate')}</dt><dd className="font-medium">{actualRate(totalRate, employeeShare)}</dd></div>
              <div><dt className="text-muted-foreground">{copy('employerRate')}</dt><dd className="font-medium">{actualRate(totalRate, employerShare)}</dd></div>
              <div><dt className="text-muted-foreground">{copy('franchiseCap')}</dt><dd className="font-medium">€ {arrangement.annual_franchise.toFixed(2)} / {arrangement.annual_pensionable_salary_cap === null ? '—' : `€ ${arrangement.annual_pensionable_salary_cap.toFixed(2)}`}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">{copy('eligibilitySummary')}: {jsonString(eligibility, 'participantGroup', copy('allEligible'))}</p>
            {current ? <details className="rounded-[var(--radius-control)] border border-subtle p-4">
              <summary className="cursor-pointer font-medium">{copy('newVersionTitle', { version: current.version_number })}</summary>
              <form action={createPensionArrangementVersionSettingsAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="predecessorVersionId" value={current.id} />
                <input type="hidden" name="code" value={arrangement.code} />
                <input type="hidden" name="name" value={arrangement.name} />
                <label className="grid gap-1 text-sm font-medium">{copy('effectiveFrom')}<TextInput name="effectiveFrom" type="date" defaultValue={current.effective_from} required /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('effectiveTo')}<TextInput name="effectiveTo" type="date" defaultValue={current.effective_to ?? ''} /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('employeeRate')}<TextInput name="employeeRatePercent" inputMode="decimal" min="0" step="0.01" type="number" defaultValue={actualRate(totalRate, employeeShare).replace('%', '')} required /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('employerRate')}<TextInput name="employerRatePercent" inputMode="decimal" min="0" step="0.01" type="number" defaultValue={actualRate(totalRate, employerShare).replace('%', '')} required /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('annualFranchise')}<TextInput name="annualFranchise" inputMode="decimal" min="0" step="0.01" type="number" defaultValue={current.annual_franchise} required /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('annualCap')}<TextInput name="annualPensionableSalaryCap" inputMode="decimal" min="0" step="0.01" type="number" defaultValue={current.annual_pensionable_salary_cap ?? ''} required /></label>
                <label className="grid gap-1 text-sm font-medium">{copy('participantGroup')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" defaultValue={jsonString(eligibility, 'participantGroup', 'NEW_ENTRANT')} name="participantGroup"><option value="NEW_ENTRANT">{copy('newEntrant')}</option><option value="GRANDFATHERED">{copy('grandfathered')}</option></select></label>
                <div className="flex items-end md:col-span-2 xl:col-span-3"><Button type="submit" variant="secondary">{copy('saveVersion')}</Button></div>
              </form>
            </details> : null}
            <ol className="space-y-2 text-sm" aria-label={copy('versionHistory')}>
              {versions.map((version) => <li className="border-l-2 border-subtle pl-3" key={version.id}>{copy('versionSummary', { version: version.version_number, date: version.effective_from })}{version.supersession_reason ? ` · ${version.supersession_reason}` : ''}</li>)}
            </ol>
          </article>
        })}
      </div>}
    </Surface>

    <Surface className="space-y-5 p-5 sm:p-6">
      <SectionHeader title={copy('employeesTitle')} description={copy('employeesDescription')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-control)] border border-success/30 bg-success-surface p-4"><p className="text-xs font-medium text-muted-foreground">{copy('linked')}</p><p className="mt-1 text-2xl font-semibold">{linkedEmployments.length}</p></div>
        <div className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-surface p-4"><p className="text-xs font-medium text-muted-foreground">{copy('unlinked')}</p><p className="mt-1 text-2xl font-semibold">{unlinkedEmployments.length}</p></div>
      </div>
      {unlinkedEmployments.length === 0 ? <p className="text-sm text-muted-foreground">{copy('allLinked')}</p> : <ul className="divide-y divide-subtle border-y border-subtle">{unlinkedEmployments.map((employment) => {
        const defaultArrangement = activeArrangements[0] ?? null
        const defaultEffectiveFrom = defaultArrangement && defaultArrangement.effective_from > employment.startsOn
          ? defaultArrangement.effective_from
          : employment.startsOn
        const defaultEffectiveTo = defaultArrangement?.effective_to ?? ''
        return <li className="grid gap-4 py-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]" key={employment.id}>
        <div><p className="font-semibold">{employment.employeeName}</p><p className="text-sm text-muted-foreground">{employment.employeeNumber ?? '—'} · {employment.employmentNumber}</p><Link className="mt-2 inline-block text-sm font-semibold text-primary hover:underline" href={`/employees/${employment.employeeId}/employments/${employment.id}/pension`}>{copy('openEmployment')}</Link></div>
        {activeArrangements.length === 0 ? <p className="text-sm text-muted-foreground">{copy('createBeforeAssign')}</p> : <form action={assignPensionArrangementFromSettingsAction} className="grid gap-3 rounded-[var(--radius-control)] border border-subtle p-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="employeeId" value={employment.employeeId} /><input type="hidden" name="employmentId" value={employment.id} /><input type="hidden" name="requestKey" value={crypto.randomUUID()} /><input type="hidden" name="supersedesAssignmentId" value="" /><input type="hidden" name="supersedesMappingId" value="" />
          <label className="grid gap-1 text-sm font-medium md:col-span-2">{copy('arrangement')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" name="arrangementId" required defaultValue=""><option value="" disabled>{copy('chooseArrangement')}</option>{activeArrangements.map((arrangement) => <option key={arrangement.id} value={arrangement.id}>{arrangement.name} · {arrangement.code}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">{copy('participationStart')}<TextInput name="participationStartDate" type="date" defaultValue={employment.startsOn} required /></label>
          <label className="grid gap-1 text-sm font-medium">{copy('effectiveFrom')}<TextInput name="effectiveFrom" type="date" defaultValue={defaultEffectiveFrom} required /></label>
          <label className="grid gap-1 text-sm font-medium">{copy('effectiveTo')}<TextInput name="effectiveTo" type="date" defaultValue={defaultEffectiveTo} /></label>
          <label className="grid gap-1 text-sm font-medium">{copy('participantGroup')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" defaultValue="NEW_ENTRANT" name="participantGroup"><option value="NEW_ENTRANT">{copy('newEntrant')}</option><option value="GRANDFATHERED">{copy('grandfathered')}</option></select></label>
          <label className="flex items-start gap-3 text-sm md:col-span-2"><input className="mt-1" name="confirmMapping" type="checkbox" value="yes" required /><span>{copy('confirmMapping')}</span></label>
          <div className="flex items-end xl:col-span-1"><Button type="submit">{copy('assignAction')}</Button></div>
        </form>}
      </li>
      })}</ul>}
      {linkedEmployments.length > 0 ? <div className="space-y-3"><h3 className="font-semibold">{copy('linkedTitle')}</h3><ul className="divide-y divide-subtle border-y border-subtle">{linkedEmployments.map((employment) => <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={employment.id}><div><p className="font-medium">{employment.employeeName} · {employment.employmentNumber}</p><p className="text-muted-foreground">{employment.assignment?.effective_from} · {employment.assignment?.pension_arrangement_id}</p></div><Link className={buttonClasses({ variant: 'secondary', size: 'sm' })} href={`/employees/${employment.employeeId}/employments/${employment.id}/pension`}>{copy('openEmployment')}</Link></li>)}</ul></div> : null}
    </Surface>
  </PageShell>
}
