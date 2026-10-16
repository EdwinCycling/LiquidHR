import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { Button, buttonClasses } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { AuthorizationError } from '@/lib/auth/permissions'
import {
  EmploymentPayrollTaxProfileError,
  getPayrollFiscalAdministrationSettings,
} from '@/lib/employment/employment-payroll-tax-profile-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import { formatDate } from '@/lib/preferences/formatters'
import { registerPayrollTaxNumberAction } from './actions'

type PageProps = { searchParams: Promise<{ q?: string; status?: string; registration?: string }> }
type FiscalFilter = 'all' | 'present' | 'missing'

export default async function PayrollFiscalSettingsPage({ searchParams }: PageProps) {
  const [query, locale, preferences, t] = await Promise.all([
    searchParams,
    getLocale(),
    getUserPreferences(),
    getTranslator('settings'),
  ])
  let data: Awaited<ReturnType<typeof getPayrollFiscalAdministrationSettings>>
  try {
    data = await getPayrollFiscalAdministrationSettings()
  } catch (error) {
    if (error instanceof AuthorizationError || (error instanceof EmploymentPayrollTaxProfileError && error.status === 403)) redirect('/geen-toegang')
    throw error
  }

  const copy = (key: string) => t(`payrollFiscal.${key}`)
  const today = new Date().toISOString().slice(0, 10)
  const search = (query.q ?? '').trim().slice(0, 120)
  const filter: FiscalFilter = query.status === 'present' || query.status === 'missing' ? query.status : 'all'
  const normalizedSearch = search.toLocaleLowerCase()
  const filteredRows = data.rows.filter((row) => {
    const searchMatch = !normalizedSearch || `${row.employeeName} ${row.employeeNumber} ${row.employmentNumber}`
      .toLocaleLowerCase().includes(normalizedSearch)
    const statusMatch = filter === 'all' || (filter === 'present' ? row.fiscalProfilePresent : row.active && !row.fiscalProfilePresent)
    return searchMatch && statusMatch
  })
  const activeRows = data.rows.filter((row) => row.active)
  const dateLabel = (value: string | null) => value ? formatDate(value, { locale, dateFormat: preferences.dateFormat }) : copy('notRecorded')
  const periodLabel = (from: string, to: string | null) => `${dateLabel(from)} – ${to ? dateLabel(to) : copy('openEnded')}`
  const registrationResult = ['saved', 'invalid', 'conflict', 'forbidden', 'unavailable'].includes(query.registration ?? '')
    ? query.registration
    : null
  const registrationMessage = registrationResult === 'saved' ? copy('registrationSaved')
    : registrationResult === 'invalid' ? copy('registrationInvalid')
      : registrationResult === 'conflict' ? copy('registrationConflict')
        : registrationResult === 'forbidden' ? copy('registrationForbidden')
          : registrationResult === 'unavailable' ? copy('registrationUnavailable')
            : null
  const incomeRelationshipStatus = (status: string) => status === 'DRAFT' ? copy('incomeRelationshipDraft')
    : status === 'READY' ? copy('incomeRelationshipReady')
      : status === 'REPORTED' ? copy('incomeRelationshipReported')
        : status === 'CLOSED' ? copy('incomeRelationshipClosed')
          : copy('incomeRelationshipStatusUnavailable')

  return <PageShell className="space-y-6 py-6 lg:py-9">
    <PageHeader title={copy('title')} description={copy('description')} />
    <p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4 text-sm">{copy('scopeNotice')}</p>
    {registrationMessage ? <p className={`rounded-[var(--radius-control)] border p-4 text-sm ${registrationResult === 'saved' ? 'border-success/30 bg-success-surface text-success' : 'border-warning/40 bg-warning-surface text-warning'}`} role={registrationResult === 'saved' ? 'status' : 'alert'}>
      {registrationMessage}
    </p> : null}

    <section aria-label={copy('administration')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Surface className="p-4"><p className="text-xs font-medium text-muted-foreground">{copy('administration')}</p><p className="mt-1 font-semibold">{data.administration.name}</p></Surface>
      <Surface className="p-4"><p className="text-xs font-medium text-muted-foreground">{copy('profileCoverage')}</p><p className="mt-1 font-semibold">{activeRows.filter((row) => row.fiscalProfilePresent).length} / {activeRows.length}</p></Surface>
      <Surface className="p-4"><p className="text-xs font-medium text-muted-foreground">{copy('missingIkv')}</p><p className="mt-1 font-semibold">{activeRows.filter((row) => row.incomeRelationshipCount !== 1).length}</p></Surface>
      <Surface className="p-4"><p className="text-xs font-medium text-muted-foreground">{copy('taxYear')}</p><p className="mt-1 font-semibold">{copy('taxYearValue')}</p></Surface>
    </section>

    <Surface className="space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{copy('payrollNumberSource')}</h2>
      <p className="text-sm text-muted-foreground">{copy('taxNumberHistoryDescription')}</p>
      {data.payrollTaxNumbers.length === 0 ? <p className="text-sm text-muted-foreground">{copy('taxNumberMissing')}</p> : <ul className="divide-y divide-subtle border-y border-subtle">{data.payrollTaxNumbers.map((number) => <li className="grid gap-3 py-4 text-sm lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(16rem,1.5fr)]" key={number.id}>
        <div>
          <p className="font-semibold">{number.payrollTaxNumber}{number.isPrimary ? ` · ${copy('numberPrimary')}` : ` · ${copy('numberOther')}`}</p>
          <p className="mt-1 text-muted-foreground">{copy('taxNumberSubnumber')}: {number.payrollTaxSubnumber}</p>
        </div>
        <p className="text-muted-foreground">{copy('taxNumberPeriod')}: {periodLabel(number.validFrom, number.validUntil)}</p>
        <div>
          <p className="font-medium">{number.linkedIncomeRelationships.length} {copy('linkedIncomeRelationships')}</p>
          {number.linkedIncomeRelationships.length > 0 ? <ul className="mt-2 space-y-1">{number.linkedIncomeRelationships.map((relationship) => <li key={`${number.id}-${relationship.employeeId}-${relationship.ikvNumber}`}>
            <Link className="text-primary hover:underline" href={`/employees/${relationship.employeeId}`}>
              {relationship.employeeName || relationship.employeeNumber || copy('employee')}
              {' · '}{copy('incomeRelationshipNumber')} {String(relationship.ikvNumber).padStart(4, '0')}
            </Link>
            <span className="text-muted-foreground">{' · '}{incomeRelationshipStatus(relationship.reportingStatus)}</span>
          </li>)}</ul> : <p className="mt-1 text-muted-foreground">{copy('noLinkedIncomeRelationships')}</p>}
        </div>
      </li>)}</ul>}
      {data.canManagePayrollTaxNumbers ? <form action={registerPayrollTaxNumberAction} className="grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm font-medium">{copy('taxNumber')}<TextInput autoComplete="off" maxLength={12} name="payrollTaxNumber" pattern="[0-9]{9}L(0[1-9]|[1-9][0-9])" placeholder={copy('taxNumberPlaceholder')} required /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('taxNumberValidFrom')}<TextInput name="validFrom" required type="date" defaultValue={today} /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('taxNumberValidUntil')}<TextInput name="validUntil" type="date" /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('taxNumberPriority')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" defaultValue="true" name="isPrimary"><option value="true">{copy('numberPrimary')}</option><option value="false">{copy('numberOther')}</option></select></label>
        <div className="flex items-end"><Button type="submit">{copy('addOrChangeTaxNumber')}</Button></div>
        <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-5">{copy('taxNumberHistoryHelp')}</p>
      </form> : null}
      <p className="border-t border-subtle pt-4 text-sm text-muted-foreground">{copy('supportedRules')}: {copy('supportedRulesValue')}</p>
    </Surface>

    <Surface className="space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{copy('employeeList')}</h2>
      <form action="/settings/payroll/fiscal" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]" method="get">
        <label className="grid gap-1 text-sm font-medium">{copy('search')}<TextInput autoComplete="off" defaultValue={search} maxLength={120} name="q" placeholder={copy('searchPlaceholder')} /></label>
        <label className="grid gap-1 text-sm font-medium">{copy('filter')}<select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" defaultValue={filter} name="status"><option value="all">{copy('all')}</option><option value="present">{copy('presentOnly')}</option><option value="missing">{copy('missingOnly')}</option></select></label>
        <div className="flex items-end"><Button type="submit">{copy('applyFilter')}</Button></div>
      </form>

      {filteredRows.length === 0 ? <p className="rounded-[var(--radius-control)] border border-subtle p-4 text-sm text-muted-foreground">{copy('noResults')}</p> : <>
        <ul className="space-y-3 sm:hidden">{filteredRows.map((row) => {
          const status = !row.active ? copy('ended') : row.fiscalProfilePresent ? copy('present') : copy('missing')
          return <li className="rounded-[var(--radius-control)] border border-subtle p-4" key={row.employmentId}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{row.employeeName || row.employeeNumber}</p><p className="mt-1 text-sm text-muted-foreground">{copy('employment')} {row.employmentNumber}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${row.fiscalProfilePresent ? 'bg-success-surface text-success' : row.active ? 'bg-warning-surface text-warning' : 'bg-muted text-muted-foreground'}`}>{status}</span></div>
            <p className="mt-3 text-sm text-muted-foreground">{copy('period')}: {periodLabel(row.startsOn, row.endsOn)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy('incomeRelationships')}: {row.incomeRelationshipCount}</p>
            <Link className={`${buttonClasses({ variant: 'secondary', size: 'sm' })} mt-3`} href={`/employees/${row.employeeId}/employments/${row.employmentId}/fiscal?tab=taxes`}>{copy('manage')}</Link>
          </li>
        })}</ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-y border-subtle bg-muted/40 text-xs uppercase tracking-[0.1em] text-muted-foreground"><tr><th className="px-3 py-3">{copy('employee')}</th><th className="px-3 py-3">{copy('employment')}</th><th className="px-3 py-3">{copy('period')}</th><th className="px-3 py-3">{copy('incomeRelationships')}</th><th className="px-3 py-3">{copy('status')}</th><th className="px-3 py-3"><span className="sr-only">{copy('manage')}</span></th></tr></thead>
            <tbody className="divide-y divide-subtle">{filteredRows.map((row) => {
              const status = !row.active ? copy('ended') : row.fiscalProfilePresent ? copy('present') : copy('missing')
              return <tr key={row.employmentId}><td className="px-3 py-3"><p className="font-semibold">{row.employeeName || row.employeeNumber}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.employeeNumber}</p></td><td className="px-3 py-3">{row.employmentNumber}</td><td className="px-3 py-3">{periodLabel(row.startsOn, row.endsOn)}</td><td className="px-3 py-3">{row.incomeRelationshipCount}</td><td className="px-3 py-3">{status}</td><td className="px-3 py-3"><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}/employments/${row.employmentId}/fiscal?tab=taxes`}>{copy('manage')}</Link></td></tr>
            })}</tbody>
          </table>
        </div>
      </>}
    </Surface>
  </PageShell>
}
