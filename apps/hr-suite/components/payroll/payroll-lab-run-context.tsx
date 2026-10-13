export type PayrollLabRunContextProps = {
  contextLabel: string
  administrationLabel: string
  administration: string
  periodLabel: string
  period: string
  scenarioLabel: string
  scenario: string
  rulePackageLabel: string
  rulePackage: string
}

export function PayrollLabRunContext({
  contextLabel,
  administrationLabel,
  administration,
  periodLabel,
  period,
  scenarioLabel,
  scenario,
  rulePackageLabel,
  rulePackage,
}: PayrollLabRunContextProps) {
  return (
    <section aria-label={contextLabel} className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface-subtle p-4">
      <h2 className="text-sm font-semibold text-foreground">{contextLabel}</h2>
      <dl className="mt-3 grid min-w-0 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{administrationLabel}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{administration}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{periodLabel}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{period}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{scenarioLabel}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{scenario}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{rulePackageLabel}</dt><dd className="mt-1 break-words font-mono text-xs text-foreground">{rulePackage}</dd></div>
      </dl>
    </section>
  )
}
