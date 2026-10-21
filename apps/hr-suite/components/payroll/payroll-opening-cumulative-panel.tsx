import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { savePayrollOpeningCumulativeAction } from '@/app/(dashboard)/payroll/settings/actions'
import type { PayrollSetupReadModel } from '@/lib/payroll/payroll-setup-service'

type Props = {
  readonly setup: PayrollSetupReadModel
  readonly canWrite: boolean
  readonly labels: Readonly<Record<string, string>>
  readonly statusMessage?: string
  readonly queryBlockers?: readonly string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function snapshotDetail(snapshot: PayrollSetupReadModel['openingSnapshots'][number], key: string): string {
  const opening = asRecord(snapshot.opening_balance_json)
  const value = opening?.[key]
  if (typeof value === 'string') return value
  const meaning = asRecord(opening?.meaning)
  return typeof meaning?.[key] === 'string' ? meaning[key] as string : '—'
}

function Field({ label, name }: { readonly label: string; readonly name: string }) {
  return <label className="grid gap-1 text-sm">
    <span>{label}</span>
    <TextInput name={name} required inputMode="decimal" placeholder="0.00" />
  </label>
}

export function PayrollOpeningCumulativePanel({ setup, canWrite, labels, statusMessage, queryBlockers = [] }: Props) {
  const label = (key: string) => labels[key] ?? key
  const shownBlockers = queryBlockers
  const employeeLabel = (employee: PayrollSetupReadModel['employeeOptions'][number]) =>
    [employee.employeeNumber, employee.employeeName, employee.employmentNumber ? `(${employee.employmentNumber})` : null]
      .filter((part): part is string => Boolean(part)).join(' · ')

  return <div className="space-y-5">
    <Surface className="space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{label('openingBalanceTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{label('openingBalanceDescription')}</p>
      </div>
      {statusMessage === 'saved' ? <p role="status" className="rounded-[var(--radius-control)] border border-success-border bg-success-surface p-3 text-sm text-success-foreground">{label('openingBalanceSaved')}</p> : null}
      {statusMessage && statusMessage !== 'saved' ? <p role="alert" className="rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{label('openingBalanceSaveFailed')}</p> : null}
      {shownBlockers.length > 0 ? <div className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-3 text-sm" role="alert">
        <p className="font-semibold">{label('openingBalanceBlockersTitle')}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{shownBlockers.map((code) => <li key={code}>{label(`openingBalanceBlocker_${code}`)}</li>)}</ul>
      </div> : null}
      {setup.employeeOptions.length === 0 ? <p className="text-sm text-muted-foreground">{label('openingBalanceNoEmployees')}</p> : null}
      {canWrite && setup.employeeOptions.length > 0 ? <form action={savePayrollOpeningCumulativeAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2"><span>{label('openingBalanceEmployee')}</span><select name="sourceEmploymentId" required className="h-10 rounded-[var(--radius-control)] border border-input bg-background px-3 text-sm"><option value="">{label('openingBalanceSelectEmployee')}</option>{setup.employeeOptions.map((employee) => <option key={employee.employmentId} value={employee.employmentId}>{employeeLabel(employee)} · {employee.startsOn}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span>{label('openingBalanceSourcePeriodFrom')}</span><TextInput name="sourcePeriodFrom" type="date" required /></label>
          <label className="grid gap-1 text-sm"><span>{label('openingBalanceSourcePeriodTo')}</span><TextInput name="sourcePeriodTo" type="date" required /></label>
          <label className="grid gap-1 text-sm"><span>{label('openingBalanceAsOfDate')}</span><TextInput name="asOfDate" type="date" required /></label>
          <label className="grid gap-1 text-sm sm:col-span-2"><span>{label('openingBalanceSourceReference')}</span><TextInput name="sourceReference" required /></label>
        </div>

        <fieldset className="space-y-3">
          <legend className="font-semibold">{label('openingBalanceMeaningTitle')}</legend>
          <p className="text-sm text-muted-foreground">{label('openingBalanceMeaningDescription')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={label('grossWageBeforePeriod')} name="grossWageBeforePeriod" />
            <Field label={label('taxableWageBeforePeriod')} name="taxableWageBeforePeriod" />
            <Field label={label('wageTaxBeforePeriod')} name="wageTaxBeforePeriod" />
            <Field label={label('employeeInsuranceWageBeforePeriod')} name="employeeInsuranceWageBeforePeriod" />
            <Field label={label('zvwWageBeforePeriod')} name="zvwWageBeforePeriod" />
            <Field label={label('holidayReserveBeforePeriod')} name="holidayReserveBeforePeriod" />
            <Field label={label('yearEndReserveBeforePeriod')} name="yearEndReserveBeforePeriod" />
          </div>
        </fieldset>
        <p className="text-sm text-muted-foreground">{label('openingBalanceNoSyntheticValues')}</p>
        <Button type="submit">{label('openingBalanceSave')}</Button>
      </form> : !canWrite ? <p className="text-sm text-muted-foreground">{label('writePermissionRequired')}</p> : null}
    </Surface>

    <Surface className="space-y-3 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{label('openingBalanceHistoryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{label('openingBalanceHistoryDescription')}</p>
      </div>
      {setup.openingSnapshots.length === 0 ? <p className="text-sm text-muted-foreground">{label('openingBalanceHistoryEmpty')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[56rem] text-left text-sm"><thead><tr className="border-b border-border-subtle text-xs text-muted-foreground"><th className="px-2 py-2">{label('openingBalanceEmployee')}</th><th className="px-2 py-2">{label('version')}</th><th className="px-2 py-2">{label('openingBalanceAsOfDate')}</th><th className="px-2 py-2">{label('openingBalanceSourcePeriod')}</th><th className="px-2 py-2">{label('openingBalanceSourceReference')}</th><th className="px-2 py-2">{label('hash')}</th></tr></thead><tbody>{setup.openingSnapshots.map((snapshot) => {
        const employee = setup.employeeOptions.find((option) => option.employmentId === snapshot.source_employment_id)
        return <tr key={snapshot.id} className="border-b border-border-subtle"><td className="px-2 py-2">{employee ? employeeLabel(employee) : snapshot.source_employment_id}</td><td className="px-2 py-2">{snapshot.snapshot_version}</td><td className="px-2 py-2">{snapshot.as_of_date}</td><td className="px-2 py-2">{snapshotDetail(snapshot, 'sourcePeriodFrom')} – {snapshotDetail(snapshot, 'sourcePeriodTo')}</td><td className="px-2 py-2">{snapshot.provenance_source}</td><td className="px-2 py-2 font-mono text-xs">{snapshot.snapshot_hash.slice(0, 12)}…</td></tr>
      })}</tbody></table></div>}
    </Surface>
  </div>
}
