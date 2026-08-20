'use client'

import { useState } from 'react'
import { calculateSalaryBandPosition, calculateSalaryFromBandPercentage, type SalaryBandPositionBand } from '@/lib/salary-application/calculations'

interface SalaryBandPercentageDraft {
  sourceKey: string
  value: string
}

export function salaryBandPercentageSourceKey(salaryAmount: string, band: SalaryBandPositionBand): string {
  return JSON.stringify([salaryAmount, band.minimum, band.midpoint, band.maximum])
}

export function resolveSalaryBandPercentageValue(draft: SalaryBandPercentageDraft, sourceKey: string, derivedPercentage: string): string {
  return draft.sourceKey === sourceKey ? draft.value : derivedPercentage
}

export function SalaryBandPercentageControl({ salaryAmount, band, labels, onSalaryAmountChange }: {
  salaryAmount: string
  band: SalaryBandPositionBand
  labels: { percentage: string; percentageHelp: string }
  onSalaryAmountChange: (value: string) => void
}) {
  const derivedPercentage = safePercentage(salaryAmount, band)
  const sourceKey = salaryBandPercentageSourceKey(salaryAmount, band)
  const [draft, setDraft] = useState<SalaryBandPercentageDraft>(() => ({ sourceKey, value: derivedPercentage }))
  const percentage = resolveSalaryBandPercentageValue(draft, sourceKey, derivedPercentage)

  function updatePercentage(value: string): void {
    setDraft({ sourceKey, value })
    const salary = calculateSalaryFromBandPercentage(value, band)
    if (salary !== null) onSalaryAmountChange(salary)
  }

  return <div className="rounded-xl border bg-muted/20 p-4">
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{labels.percentage}</span>
      <div className="flex items-center gap-2">
        <input aria-describedby="salary-band-percentage-help" className="form-field" inputMode="decimal" min="0" onChange={(event) => updatePercentage(event.target.value)} step="0.01" type="number" value={percentage} />
        <span className="text-sm font-semibold">%</span>
      </div>
    </label>
    <p className="mt-2 text-xs text-muted-foreground" id="salary-band-percentage-help">{labels.percentageHelp}</p>
  </div>
}

function safePercentage(salaryAmount: string, band: SalaryBandPositionBand): string {
  try {
    return calculateSalaryBandPosition(salaryAmount || '0.00', band).compaRatioPercentage ?? ''
  } catch {
    return ''
  }
}
