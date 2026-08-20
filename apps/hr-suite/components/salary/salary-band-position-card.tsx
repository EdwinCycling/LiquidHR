import { calculateSalaryBandPosition, type SalaryBandPositionBand } from '@/lib/salary-application/calculations'

type Labels = {
  preview: string
  currentSalary: string
  minimum: string
  midpoint: string
  maximum: string
  compaRatio: string
  rangePenetration: string
  status: string
  underMinimum: string
  withinRange: string
  aboveMaximum: string
  noValidBand: string
  openEnded: string
}

function money(value: string | null, locale: string, currencyCode: string): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function SalaryBandPositionCard({
  salaryAmount,
  band,
  locale,
  currencyCode,
  labels,
}: {
  salaryAmount: string
  band: SalaryBandPositionBand | null
  locale: string
  currencyCode: string
  labels: Labels
}) {
  const position = calculateSalaryBandPosition(salaryAmount, band)
  const minimum = band ? Number(band.minimum) : 0
  const midpoint = band ? Number(band.midpoint) : 0
  const maximum = band?.maximum === null || band === null ? null : Number(band.maximum)
  const scaleMaximum = maximum ?? Math.max(Number(salaryAmount), midpoint * 1.5, minimum + 1)
  const midpointPosition = band ? clamp(((midpoint - minimum) / (scaleMaximum - minimum)) * 100) : 50
  const salaryPosition = band ? clamp(((Number(salaryAmount) - minimum) / (scaleMaximum - minimum)) * 100) : 50
  const statusLabel = position.status === 'UNDER_MINIMUM' ? labels.underMinimum
    : position.status === 'ABOVE_MAXIMUM' ? labels.aboveMaximum
      : position.status === 'WITHIN_RANGE' ? labels.withinRange : labels.noValidBand

  return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="eyebrow">{labels.preview}</p><h3 className="mt-1 text-lg font-semibold">{labels.currentSalary}: {money(salaryAmount, locale, currencyCode)}</h3></div>
      <span className="status-chip bg-primary/10 text-primary">{statusLabel}</span>
    </div>
    <div className="relative mt-7 h-24" aria-label={`${labels.minimum} ${money(band?.minimum ?? null, locale, currencyCode)}, ${labels.midpoint} ${money(band?.midpoint ?? null, locale, currencyCode)}, ${labels.maximum} ${money(band?.maximum ?? null, locale, currencyCode)}`}>
      <div className="absolute left-0 right-0 top-5 h-1 rounded-full bg-primary/20" />
      <div className="absolute left-0 top-5 h-1 rounded-full bg-primary" style={{ width: `${maximum === null ? 100 : midpointPosition}%` }} />
      {band && <>
        <span className="absolute top-2 size-2 -translate-x-1/2 rounded-full bg-primary" style={{ left: '0%' }} />
        <span className="absolute top-2 size-2 -translate-x-1/2 rounded-full bg-primary" style={{ left: `${midpointPosition}%` }} />
        {maximum !== null && <span className="absolute top-2 size-2 -translate-x-1/2 rounded-full bg-primary" style={{ left: '100%' }} />}
      </>}
      <span className="absolute top-0 size-3 -translate-x-1/2 rounded-full border-2 border-background bg-foreground shadow-sm" style={{ left: `${salaryPosition}%` }} aria-hidden="true" />
      <div className="absolute inset-x-0 top-10 flex justify-between gap-2 text-xs text-muted-foreground">
        <span><span className="block font-medium">{labels.minimum}</span><span className="font-semibold text-foreground">{money(band?.minimum ?? null, locale, currencyCode)}</span></span>
        <span className="text-center"><span className="block font-medium">{labels.midpoint}</span><span className="font-semibold text-foreground">{money(band?.midpoint ?? null, locale, currencyCode)}</span></span>
        <span className="text-right"><span className="block font-medium">{labels.maximum}</span><span className="font-semibold text-foreground">{band?.maximum === null ? labels.openEnded : money(band?.maximum ?? null, locale, currencyCode)}</span></span>
      </div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Metric label={labels.compaRatio} value={position.compaRatioPercentage === null ? '—' : `${position.compaRatioPercentage}%`} />
      <Metric label={labels.rangePenetration} value={position.rangePenetrationPercentage === null ? '—' : `${position.rangePenetrationPercentage}%`} />
      <Metric label={labels.status} value={statusLabel} />
    </div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-background px-3 py-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>
}
