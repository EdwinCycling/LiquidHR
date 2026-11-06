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
  readonly sourceHash: string | null
  readonly baseline: Amounts | null
  readonly scenario: Amounts | null
  readonly difference: Amounts | null
  readonly hashes: {
    readonly baselineInput: string | null
    readonly baselineResult: string | null
    readonly scenarioInput: string | null
    readonly scenarioResult: string | null
  }
  readonly traceSteps: number
  readonly gaps: readonly { readonly field: string; readonly status: string; readonly reasonCode: string }[]
}

type Labels = {
  readonly scenarioType: string
  readonly bonus: string
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

function formatMoney(value: string | null, locale: string): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value))
}

function scenarioPayload(type: ScenarioType, value: string): Record<string, string> {
  if (type === 'BONUS') return { type, amount: value }
  if (type === 'EXTRA_PAID_HOURS') return { type, hours: value }
  if (type === 'SALARY_INCREASE') return { type, percentage: value }
  return { type, hoursPerWeek: value }
}

export function PayrollProForma({ locale, labels }: { readonly locale: string; readonly labels: Labels }) {
  const [type, setType] = useState<ScenarioType>('BONUS')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<ProFormaResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputLabel = type === 'BONUS' ? labels.amount
    : type === 'EXTRA_PAID_HOURS' ? labels.hours
      : type === 'SALARY_INCREASE' ? labels.percentage
        : labels.hoursPerWeek
  const statusText = result?.status === 'SOURCE_GAP' ? labels.sourceGap
    : result?.status === 'INCOMPLETE' ? labels.sourceIncomplete
      : result?.status === 'UNSUPPORTED' ? labels.scenarioUnsupported
        : result?.status === 'CALCULATION_FAILED' ? labels.calculationFailed
          : labels.sourceReady

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/my-salary/pro-forma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioPayload(type, value.trim().replace(',', '.'))),
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
      <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto] sm:items-end" onSubmit={submit}>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          <span>{labels.scenarioType}</span>
          <select className="min-h-11 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-foreground focus-visible:outline-2 focus-visible:outline-focus" onChange={(event) => { setType(event.currentTarget.value as ScenarioType); setValue(''); setResult(null) }} value={type}>
            <option value="BONUS">{labels.bonus}</option>
            <option value="EXTRA_PAID_HOURS">{labels.extraPaidHours}</option>
            <option value="SALARY_INCREASE">{labels.salaryIncrease}</option>
            <option value="CONTRACT_HOURS">{labels.contractHours}</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          <span>{inputLabel}</span>
          <input autoComplete="off" className="min-h-11 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-foreground focus-visible:outline-2 focus-visible:outline-focus" inputMode="decimal" onChange={(event) => setValue(event.currentTarget.value)} required type="text" value={value} />
        </label>
        <button className="min-h-11 rounded-[var(--radius-control)] bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">{pending ? labels.calculating : labels.calculate}</button>
      </form>
      <p className="text-sm text-muted-foreground">{labels.explanation}</p>
      {error ? <p className="rounded-[var(--radius-control)] border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">{error}</p> : null}
    </Surface>

    {result ? <section aria-live="polite" className="space-y-4">
      <Surface className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div><h2 className="text-lg font-semibold">{statusText}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.period}: {String(result.period.month).padStart(2, '0')}-{result.period.year}</p></div>
        {result.sourceStatus !== 'READY' ? <span className="rounded-full border border-border-subtle px-3 py-1 text-xs font-medium">{result.sourceStatus === 'SOURCE_GAP' ? labels.sourceGap : labels.sourceIncomplete}</span> : null}
      </Surface>

      {result.baseline && result.scenario && result.difference ? <Surface className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-border-subtle bg-surface-subtle"><tr>
              <th className="px-4 py-3 font-semibold" scope="col">{labels.metric}</th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">{labels.baseline}</th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">{labels.scenario}</th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">{labels.difference}</th>
            </tr></thead>
            <tbody className="divide-y divide-border-subtle">{amountRows.map(([key, label]) => <tr key={key}>
              <th className="px-4 py-3 font-medium" scope="row">{labels[label]}</th>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(result.baseline?.[key] ?? null, locale)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(result.scenario?.[key] ?? null, locale)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(result.difference?.[key] ?? null, locale)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Surface> : null}

      {result.gaps.length > 0 ? <Surface className="p-4 text-sm" role="status">
        <p>{result.status === 'SOURCE_GAP' ? labels.sourceGap : labels.scenarioUnsupported}</p>
      </Surface> : null}

      <Surface className="space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold">{labels.explanation}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.sourceHash}</dt><dd className="mt-1 break-all font-mono text-xs">{result.sourceHash ?? '—'}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.traceSteps}</dt><dd className="mt-1 tabular-nums">{result.traceSteps}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.inputHash} · {labels.baseline}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.baselineInput ?? '—'}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.resultHash} · {labels.baseline}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.baselineResult ?? '—'}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.inputHash} · {labels.scenario}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.scenarioInput ?? '—'}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{labels.resultHash} · {labels.scenario}</dt><dd className="mt-1 break-all font-mono text-xs">{result.hashes.scenarioResult ?? '—'}</dd></div>
        </dl>
      </Surface>
    </section> : null}
  </div>
}
