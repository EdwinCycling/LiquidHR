'use client'

import { useState, type FormEvent } from 'react'
import { Surface } from '@/components/ui/surface'

type ScenarioType = 'BONUS' | 'EXTRA_PAID_HOURS' | 'SALARY_INCREASE' | 'CONTRACT_HOURS'
type Amounts = {
  readonly gross: string
  readonly employeePension: string
  readonly employerPension: string
  readonly taxableWage: string
  readonly wageTax: string
  readonly net: string
  readonly employerCosts: string
}
type ProFormaResult = {
  readonly status: 'CALCULATED' | 'SOURCE_GAP' | 'UNSUPPORTED' | 'INCOMPLETE' | 'CALCULATION_FAILED'
  readonly sourceStatus: 'READY' | 'SOURCE_GAP' | 'INCOMPLETE'
  readonly scenarioType: ScenarioType
  readonly period: { readonly year: number; readonly month: number }
  readonly sourceHash?: string | null
  readonly baseline: Amounts | null
  readonly scenario: Amounts | null
  readonly difference: Amounts | null
  readonly hashes?: {
    readonly baselineInput: string | null
    readonly baselineResult: string | null
    readonly scenarioInput: string | null
    readonly scenarioResult: string | null
  }
  readonly traceSteps?: number
  readonly gaps?: readonly { readonly field: string; readonly status: string; readonly reasonCode: string }[]
  readonly hasGaps?: boolean
}

export type Labels = {
  readonly scenarioType: string
  readonly bonus: string
  readonly bonusUnavailable: string
  readonly extraPaidHours: string
  readonly salaryIncrease: string
  readonly contractHours: string
  readonly amount: string
  readonly hours: string
  readonly percentage: string
  readonly hoursPerWeek: string
  readonly calculate: string
  readonly calculating: string
  readonly baseline: string
  readonly scenario: string
  readonly difference: string
  readonly metric: string
  readonly gross: string
  readonly employeePension: string
  readonly employerPension: string
  readonly taxableWage: string
  readonly wageTax: string
  readonly net: string
  readonly employerCosts: string
  readonly sourceReady: string
  readonly sourceGap: string
  readonly sourceIncomplete: string
  readonly scenarioUnsupported: string
  readonly calculationFailed: string
  readonly warning: string
  readonly explanation: string
  readonly inputInstruction: string
  readonly noResult: string
  readonly paySlip: string
  readonly netDifference: string
  readonly sourceHash: string
  readonly inputHash: string
  readonly resultHash: string
  readonly traceSteps: string
  readonly serviceUnavailable: string
  readonly period: string
}

const amountRows = [
  ['gross', 'gross'],
  ['employeePension', 'employeePension'],
  ['employerPension', 'employerPension'],
  ['taxableWage', 'taxableWage'],
  ['wageTax', 'wageTax'],
  ['net', 'net'],
  ['employerCosts', 'employerCosts'],
] as const

type EditableScenario = Exclude<ScenarioType, 'BONUS'>
type ScenarioInputs = Record<EditableScenario, string>

const editableScenarios: readonly {
  readonly type: EditableScenario
  readonly title: keyof Pick<Labels, 'extraPaidHours' | 'salaryIncrease' | 'contractHours'>
  readonly inputLabel: keyof Pick<Labels, 'hours' | 'percentage' | 'hoursPerWeek'>
}[] = [
  { type: 'EXTRA_PAID_HOURS', title: 'extraPaidHours', inputLabel: 'hours' },
  { type: 'SALARY_INCREASE', title: 'salaryIncrease', inputLabel: 'percentage' },
  { type: 'CONTRACT_HOURS', title: 'contractHours', inputLabel: 'hoursPerWeek' },
]

function formatMoney(value: string | null, locale: string): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatNetDifference(value: string, locale: string): string {
  const amount = Number(value)
  const formatted = formatMoney(value, locale)
  return amount > 0 ? `+${formatted}` : formatted
}

function scenarioPayload(type: ScenarioType, value: string): Record<string, string> {
  if (type === 'BONUS') return { type, amount: value }
  if (type === 'EXTRA_PAID_HOURS') return { type, hours: value }
  if (type === 'SALARY_INCREASE') return { type, percentage: value }
  return { type, hoursPerWeek: value }
}

export function PayrollProForma({ locale, labels, endpoint = '/api/my-salary/pro-forma', showProvenance = true }: {
  readonly locale: string
  readonly labels: Labels
  readonly endpoint?: string
  readonly showProvenance?: boolean
}) {
  const [type, setType] = useState<ScenarioType>('EXTRA_PAID_HOURS')
  const [values, setValues] = useState<ScenarioInputs>({
    EXTRA_PAID_HOURS: '',
    SALARY_INCREASE: '',
    CONTRACT_HOURS: '',
  })
  const [result, setResult] = useState<ProFormaResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBonus = type === 'BONUS'
  const statusText = result?.status === 'SOURCE_GAP' ? labels.sourceGap
    : result?.status === 'INCOMPLETE' ? labels.sourceIncomplete
      : result?.status === 'UNSUPPORTED' ? labels.scenarioUnsupported
        : result?.status === 'CALCULATION_FAILED' ? labels.calculationFailed
          : labels.sourceReady
  const selectedValue = type === 'BONUS' ? '' : values[type]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (type === 'BONUS' || !values[type].trim()) return
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioPayload(type, values[type].trim().replace(',', '.'))),
        cache: 'no-store',
      })
      const body: unknown = await response.json()
      if (!response.ok || typeof body !== 'object' || body === null || !('status' in body)) {
        setError(labels.serviceUnavailable)
      } else {
        setResult(body as ProFormaResult)
      }
    } catch {
      setError(labels.serviceUnavailable)
    } finally {
      setPending(false)
    }
  }

  return <div className="mx-auto w-full max-w-5xl space-y-5">
    <Surface className="space-y-5 p-4 sm:p-6">
      <p className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 text-sm" role="note">{labels.warning}</p>
      <form className="space-y-5" onSubmit={submit}>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{labels.scenarioType}</legend>
          <p className="text-sm text-muted-foreground">{labels.inputInstruction}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {editableScenarios.map((option) => {
              const selected = type === option.type
              const inputId = `pro-forma-input-${option.type.toLowerCase()}`
              const radioId = `pro-forma-option-${option.type.toLowerCase()}`
              return <div className={`min-w-0 rounded-[var(--radius-control)] border p-3 sm:p-4 ${selected ? 'border-primary bg-primary/5' : 'border-border-subtle bg-surface'}`} key={option.type}>
                <div className="flex min-w-0 items-start gap-3">
                  <input checked={selected} className="mt-1 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" id={radioId} name="pro-forma-scenario" onChange={() => { setType(option.type); setResult(null); setError(null) }} type="radio" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="block cursor-pointer font-semibold" htmlFor={radioId}>{labels[option.title]}</label>
                    <label className="block text-sm text-muted-foreground" htmlFor={inputId}>{labels[option.inputLabel]}</label>
                    <input autoComplete="off" className="min-h-11 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-foreground focus-visible:outline-2 focus-visible:outline-focus" id={inputId} inputMode="decimal" onChange={(event) => { const nextValue = event.currentTarget.value; setValues((current) => ({ ...current, [option.type]: nextValue })); setResult(null) }} required={selected} type="text" value={values[option.type]} />
                  </div>
                </div>
              </div>
            })}

            <div className="min-w-0 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <input aria-describedby="pro-forma-bonus-unavailable" className="mt-1 size-4" disabled id="pro-forma-option-bonus" name="pro-forma-scenario" type="radio" />
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block font-semibold" htmlFor="pro-forma-option-bonus">{labels.bonus}</label>
                  <label className="block text-sm text-muted-foreground" htmlFor="pro-forma-bonus-input">{labels.amount}</label>
                  <input aria-describedby="pro-forma-bonus-unavailable" aria-readonly="true" autoComplete="off" className="min-h-11 w-full cursor-not-allowed rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle px-3 text-muted-foreground" id="pro-forma-bonus-input" readOnly type="text" value="" />
                  <p className="text-sm text-muted-foreground" id="pro-forma-bonus-unavailable" role="status">{labels.bonusUnavailable}</p>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">{labels.explanation}</p>
          <button aria-describedby={isBonus ? 'pro-forma-bonus-unavailable' : undefined} className="min-h-11 shrink-0 rounded-[var(--radius-control)] bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" disabled={pending || isBonus || !selectedValue.trim()} type="submit">{pending ? labels.calculating : labels.calculate}</button>
        </div>
      </form>
      {error ? <p className="rounded-[var(--radius-control)] border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">{error}</p> : null}
    </Surface>

    {result ? <section aria-live="polite" className="space-y-4">
      <Surface className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div><h2 className="text-lg font-semibold">{statusText}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.period}: {String(result.period.month).padStart(2, '0')}-{result.period.year}</p></div>
        {result.sourceStatus !== 'READY' ? <span className="w-fit rounded-full border border-border-subtle px-3 py-1 text-xs font-medium">{result.sourceStatus === 'SOURCE_GAP' ? labels.sourceGap : labels.sourceIncomplete}</span> : null}
        {result.difference ? <div className="rounded-[var(--radius-control)] border border-border-subtle bg-primary/5 p-4 sm:col-span-2 sm:flex sm:items-end sm:justify-between">
          <div><p className="text-sm font-medium text-muted-foreground">{labels.netDifference}</p><p className="mt-1 text-sm">{labels.baseline} → {labels.scenario}</p></div>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:mt-0" data-testid="pro-forma-net-difference">{formatNetDifference(result.difference.net, locale)}</p>
        </div> : null}
      </Surface>

      {result.baseline && result.scenario && result.difference ? <Surface className="space-y-3 overflow-hidden p-4 sm:p-5">
        <h2 className="font-semibold">{labels.paySlip}</h2>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup><col className="w-[31%]" /><col className="w-[23%]" /><col className="w-[23%]" /><col className="w-[23%]" /></colgroup>
            <thead className="border-b border-border-subtle bg-surface-subtle"><tr>
              <th className="px-3 py-3 font-semibold" scope="col">{labels.metric}</th>
              <th className="px-2 py-3 text-right font-semibold" scope="col">{labels.baseline}</th>
              <th className="px-2 py-3 text-right font-semibold" scope="col">{labels.scenario}</th>
              <th className="px-3 py-3 text-right font-semibold" scope="col">{labels.difference}</th>
            </tr></thead>
            <tbody className="divide-y divide-border-subtle">{amountRows.map(([key, label]) => <tr key={key}>
              <th className="px-3 py-3 font-medium" scope="row">{labels[label]}</th>
              <td className="px-2 py-3 text-right tabular-nums">{formatMoney(result.baseline?.[key] ?? null, locale)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{formatMoney(result.scenario?.[key] ?? null, locale)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(result.difference?.[key] ?? null, locale)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {amountRows.map(([key, label]) => <article className="rounded-[var(--radius-control)] border border-border-subtle p-3" key={key}>
            <h3 className="font-medium">{labels[label]}</h3>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="min-w-0"><dt className="text-muted-foreground">{labels.baseline}</dt><dd className="mt-1 break-words font-medium tabular-nums">{formatMoney(result.baseline?.[key] ?? null, locale)}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{labels.scenario}</dt><dd className="mt-1 break-words font-medium tabular-nums">{formatMoney(result.scenario?.[key] ?? null, locale)}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{labels.difference}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{formatMoney(result.difference?.[key] ?? null, locale)}</dd></div>
            </dl>
          </article>)}
        </div>
      </Surface> : <Surface className="p-4 text-sm" role="status">{labels.noResult}</Surface>}

      {(result.hasGaps ?? (result.gaps?.length ?? 0) > 0) ? <Surface className="p-4 text-sm" role="status">
        <p>{result.status === 'SOURCE_GAP' ? labels.sourceGap : labels.scenarioUnsupported}</p>
      </Surface> : null}

      {showProvenance && result.sourceHash !== undefined && result.hashes ? <Surface className="p-4 sm:p-5">
        <details>
          <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.explanation}</summary>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.sourceHash}</dt><dd className="mt-1 break-all font-mono text-xs">{result.sourceHash ?? '—'}</dd></div>
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.traceSteps}</dt><dd className="mt-1 tabular-nums">{result.traceSteps ?? 0}</dd></div>
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.inputHash} · {labels.baseline}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.baselineInput ?? '—'}</dd></div>
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.resultHash} · {labels.baseline}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.baselineResult ?? '—'}</dd></div>
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.inputHash} · {labels.scenario}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.scenarioInput ?? '—'}</dd></div>
            <div className="min-w-0"><dt className="text-muted-foreground">{labels.resultHash} · {labels.scenario}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.scenarioResult ?? '—'}</dd></div>
          </dl>
        </details>
      </Surface> : null}
    </section> : <Surface className="border-dashed p-4 text-sm text-muted-foreground" role="status">{labels.noResult}</Surface>}
  </div>
}
