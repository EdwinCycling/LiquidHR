import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { savePayrollEmployerConfigurationAction } from '@/app/(dashboard)/payroll/settings/actions'
import {
  payrollEmployerConfigurationBlockers,
  type PayrollEmployerConfiguration,
} from '@/lib/payroll/payroll-setup'
import type { PayrollSetupReadModel } from '@/lib/payroll/payroll-setup-service'

type SetupLabels = Readonly<Record<string, string>>

type Props = {
  readonly setup: PayrollSetupReadModel
  readonly canWrite: boolean
  readonly labels: SetupLabels
  readonly statusMessage?: string
  readonly queryBlockers?: readonly string[]
}

const EMPTY_CONFIGURATION: PayrollEmployerConfiguration = {
  schemaVersion: 'payroll-employer-configuration-v1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  status: 'DRAFT',
  sourceReference: '',
  employer: {
    sectorCode: null,
    whkDecisionReference: null,
    awfClassification: null,
    aofClassification: null,
    wkoClassification: null,
    zvwClassification: null,
  },
  employerRates: { awf: null, aof: null, wko: null, whk: null, zvw: null },
  reserves: { holidayAllowanceRate: null, yearEndApplies: null, yearEndRate: null },
  componentSet: { compositionId: '', packageVersion: '', packageHash: '' },
  pension: { partialMonthMethod: 'UNCONFIGURED', methodSourceReference: null },
}

function inputValue(value: string | null | undefined): string {
  return value ?? ''
}

function LabelledInput({ label, name, value, type = 'text', required = false }: {
  readonly label: string
  readonly name: string
  readonly value: string
  readonly type?: 'text' | 'date'
  readonly required?: boolean
}) {
  return <label className="grid gap-1 text-sm">
    <span>{label}</span>
    <TextInput name={name} defaultValue={value} type={type} required={required} />
  </label>
}

export function PayrollEmployerSetupPanel({ setup, canWrite, labels, statusMessage, queryBlockers = [] }: Props) {
  const configuration = setup.latestConfigurationJson ?? setup.activeConfigurationJson ?? EMPTY_CONFIGURATION
  const blockers = payrollEmployerConfigurationBlockers(configuration)
  const shownBlockers = queryBlockers.length > 0 ? queryBlockers : blockers.map((item) => item.code)
  const label = (key: string) => labels[key] ?? key
  const yearEndValue = configuration.reserves.yearEndApplies === null
    ? 'unknown'
    : configuration.reserves.yearEndApplies ? 'true' : 'false'

  return <div className="space-y-5">
    <Surface className="space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{label('employerSetupTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{label('employerSetupDescription')}</p>
      </div>
      {statusMessage === 'saved' ? <p role="status" className="rounded-[var(--radius-control)] border border-success-border bg-success-surface p-3 text-sm text-success-foreground">{label('employerSetupSaved')}</p> : null}
      {statusMessage && statusMessage !== 'saved' ? <p role="alert" className="rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{label('employerSetupSaveFailed')}</p> : null}
      {shownBlockers.length > 0 ? <div className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-3 text-sm">
        <p className="font-semibold">{label('employerSetupBlockersTitle')}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {shownBlockers.map((code) => <li key={code}>{label(`employerSetupBlocker_${code}`)}</li>)}
        </ul>
      </div> : <p className="rounded-[var(--radius-control)] border border-success-border bg-success-surface p-3 text-sm text-success-foreground">{label('employerSetupReady')}</p>}

      {canWrite ? <form action={savePayrollEmployerConfigurationAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabelledInput label={label('effectiveFrom')} name="effectiveFrom" value={configuration.effectiveFrom} type="date" required />
          <LabelledInput label={label('effectiveTo')} name="effectiveTo" value={inputValue(configuration.effectiveTo)} type="date" />
          <div className="sm:col-span-2"><LabelledInput label={label('sourceReference')} name="sourceReference" value={configuration.sourceReference} required /></div>
        </div>

        <fieldset className="space-y-3">
          <legend className="font-semibold">{label('employerClassificationTitle')}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LabelledInput label={label('sectorCode')} name="sectorCode" value={inputValue(configuration.employer.sectorCode)} />
            <LabelledInput label={label('whkDecisionReference')} name="whkDecisionReference" value={inputValue(configuration.employer.whkDecisionReference)} />
            <LabelledInput label={label('awfClassification')} name="awfClassification" value={inputValue(configuration.employer.awfClassification)} />
            <LabelledInput label={label('aofClassification')} name="aofClassification" value={inputValue(configuration.employer.aofClassification)} />
            <LabelledInput label={label('wkoClassification')} name="wkoClassification" value={inputValue(configuration.employer.wkoClassification)} />
            <LabelledInput label={label('zvwClassification')} name="zvwClassification" value={inputValue(configuration.employer.zvwClassification)} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-semibold">{label('employerRatesTitle')}</legend>
          <p className="text-sm text-muted-foreground">{label('employerRatesDescription')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <LabelledInput label={label('awfRate')} name="awfRate" value={inputValue(configuration.employerRates.awf)} />
            <LabelledInput label={label('aofRate')} name="aofRate" value={inputValue(configuration.employerRates.aof)} />
            <LabelledInput label={label('wkoRate')} name="wkoRate" value={inputValue(configuration.employerRates.wko)} />
            <LabelledInput label={label('whkRate')} name="whkRate" value={inputValue(configuration.employerRates.whk)} />
            <LabelledInput label={label('zvwRate')} name="zvwRate" value={inputValue(configuration.employerRates.zvw)} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-semibold">{label('reservesTitle')}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LabelledInput label={label('holidayAllowanceRate')} name="holidayAllowanceRate" value={inputValue(configuration.reserves.holidayAllowanceRate)} />
            <label className="grid gap-1 text-sm"><span>{label('yearEndApplies')}</span><DropdownSelect name="yearEndApplies" defaultValue={yearEndValue}><option value="unknown">{label('unknown')}</option><option value="true">{label('yes')}</option><option value="false">{label('no')}</option></DropdownSelect></label>
            <LabelledInput label={label('yearEndRate')} name="yearEndRate" value={inputValue(configuration.reserves.yearEndRate)} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-semibold">{label('pensionMethodTitle')}</legend>
          <p className="text-sm text-muted-foreground">{label('pensionMethodDescription')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm"><span>{label('pensionPartialMonthMethod')}</span><DropdownSelect name="pensionPartialMonthMethod" defaultValue={configuration.pension.partialMonthMethod}><option value="UNCONFIGURED">{label('notConfigured')}</option><option value="CALENDAR_DAYS_PRO_RATA">{label('calendarDaysProRata')}</option><option value="FULL_MONTH">{label('fullMonth')}</option></DropdownSelect></label>
            <LabelledInput label={label('pensionMethodSourceReference')} name="pensionMethodSourceReference" value={inputValue(configuration.pension.methodSourceReference)} />
          </div>
        </fieldset>

        <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 text-sm">
          <p className="font-semibold">{label('componentSetTitle')}</p>
          <p className="mt-1 break-all text-muted-foreground">{configuration.componentSet.compositionId || label('componentSetNotCalculated')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label('componentSetVersion')}: {configuration.componentSet.packageVersion || '-'} · {label('componentSetHash')}: {configuration.componentSet.packageHash ? `${configuration.componentSet.packageHash.slice(0, 12)}…` : '-'}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="status" value="DRAFT" variant="secondary">{label('saveDraft')}</Button>
          <Button type="submit" name="status" value="ACTIVE">{label('activateConfiguration')}</Button>
        </div>
      </form> : <p className="text-sm text-muted-foreground">{label('writePermissionRequired')}</p>}
    </Surface>

    <Surface className="space-y-3 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{label('configurationHistoryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{label('configurationHistoryDescription')}</p>
      </div>
      {setup.configurations.length === 0 ? <p className="text-sm text-muted-foreground">{label('configurationHistoryEmpty')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm"><thead><tr className="border-b border-border-subtle text-xs text-muted-foreground"><th className="px-2 py-2">{label('version')}</th><th className="px-2 py-2">{label('status')}</th><th className="px-2 py-2">{label('effectivePeriod')}</th><th className="px-2 py-2">{label('sourceReference')}</th><th className="px-2 py-2">{label('hash')}</th></tr></thead><tbody>{setup.configurations.map((row) => <tr key={row.id} className="border-b border-border-subtle"><td className="px-2 py-2">{row.configuration_version}</td><td className="px-2 py-2">{row.status === 'ACTIVE' ? label('active') : label('draft')}</td><td className="px-2 py-2">{row.effective_from} – {row.effective_to ?? '…'}</td><td className="px-2 py-2">{row.source_reference}</td><td className="px-2 py-2 font-mono text-xs">{row.configuration_hash.slice(0, 12)}…</td></tr>)}</tbody></table></div>}
    </Surface>
  </div>
}
