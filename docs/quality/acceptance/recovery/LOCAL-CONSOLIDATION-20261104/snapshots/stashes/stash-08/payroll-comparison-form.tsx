'use client'

import { useState } from 'react'

export type PayrollComparisonLine = {
  readonly key: string
  readonly label: string
  readonly amount: number | null
}

export function parseExternalAmountCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null
  const [euros, fraction = ''] = normalized.split('.')
  return Number(euros) * 100 + Number((fraction + '00').slice(0, 2))
}

export type PayrollAmountDifference = { readonly externalCents: number; readonly differenceCents: number; readonly status: 'exact' | 'one-cent' | 'difference' } | null

export function comparePayrollAmount(liquidHrAmount: number | null, externalValue: string): PayrollAmountDifference {
  const externalCents = parseExternalAmountCents(externalValue)
  if (externalCents === null || liquidHrAmount === null || !Number.isFinite(liquidHrAmount)) return null
  const differenceCents = externalCents - Math.round(liquidHrAmount * 100)
  return {
    externalCents,
    differenceCents,
    status: differenceCents === 0 ? 'exact' : Math.abs(differenceCents) === 1 ? 'one-cent' : 'difference',
  }
}

function formatMoney(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)
}

export function PayrollComparisonForm({ lines, labels }: {
  readonly lines: readonly PayrollComparisonLine[]
  readonly labels: { readonly component: string; readonly liquidHr: string; readonly external: string; readonly difference: string; readonly exact: string; readonly cent: string; readonly larger: string; readonly invalid: string }
}) {
  const [entered, setEntered] = useState<Record<string, string>>({})
  const comparisons = lines.map((line) => {
    const difference = comparePayrollAmount(line.amount, entered[line.key] ?? '')
    return { ...line, externalCents: difference?.externalCents ?? null, delta: difference?.differenceCents ?? null, status: difference ? labels[difference.status === 'exact' ? 'exact' : difference.status === 'one-cent' ? 'cent' : 'larger'] : null }
  })

  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{labels.invalid}</p>
    <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border-subtle">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr>
          <th className="px-4 py-3">{labels.component}</th><th className="px-4 py-3 text-right">{labels.liquidHr}</th><th className="px-4 py-3">{labels.external}</th><th className="px-4 py-3 text-right">{labels.difference}</th>
        </tr></thead>
        <tbody className="divide-y divide-border-subtle">{comparisons.map((line) => <tr key={line.key}>
          <th scope="row" className="px-4 py-3 font-medium">{line.label}</th>
          <td className="px-4 py-3 text-right tabular-nums">{formatMoney(line.amount)}</td>
          <td className="px-4 py-3"><label className="sr-only" htmlFor={`external-${line.key}`}>{line.label}</label><input
            id={`external-${line.key}`}
            inputMode="decimal"
            autoComplete="off"
            className="w-32 max-w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-right tabular-nums focus-visible:outline-2 focus-visible:outline-focus"
            value={entered[line.key] ?? ''}
            onChange={(event) => setEntered((current) => ({ ...current, [line.key]: event.target.value }))}
          /></td>
          <td className="px-4 py-3 text-right tabular-nums">{line.delta === null ? '—' : formatMoney(line.delta / 100)}<span className="ml-2 text-xs text-muted-foreground">{line.status}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}
