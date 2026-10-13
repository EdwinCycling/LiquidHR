import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'

type ControlStatus = 'PASS' | 'WARN' | 'FAIL'

export type PayrollLabControl = {
  readonly key: string
  readonly status: ControlStatus
  readonly details?: unknown
}

type ControlTranslator = (key: string) => string

const CONTROL_COPY: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  'NL2026-CTRL-001-TAXABLE-WAGE-RECONCILIATION': ['payrollLabControlNl2026TaxableTitle', 'payrollLabControlNl2026TaxableDescription'],
  'NL2026-CTRL-002-NET-PAY-RECONCILIATION': ['payrollLabControlNl2026NetTitle', 'payrollLabControlNl2026NetDescription'],
  'NL2026-CTRL-003-NONNEGATIVE-WAGE-TAX': ['payrollLabControlNl2026TaxTitle', 'payrollLabControlNl2026TaxDescription'],
  'NL2026-CTRL-004-NONNEGATIVE-NET-PAY': ['payrollLabControlNl2026NetNonnegativeTitle', 'payrollLabControlNl2026NetNonnegativeDescription'],
  'GC1-CTRL-020': ['payrollLabControlGcGrossTitle', 'payrollLabControlGcGrossDescription'],
  'GC1-CTRL-021': ['payrollLabControlGcPensionNonnegativeTitle', 'payrollLabControlGcPensionNonnegativeDescription'],
  'GC1-CTRL-022': ['payrollLabControlGcPensionTitle', 'payrollLabControlGcPensionDescription'],
  'GC1-CTRL-023': ['payrollLabControlGcTaxTitle', 'payrollLabControlGcTaxDescription'],
  'GC1-CTRL-024': ['payrollLabControlGcNetTitle', 'payrollLabControlGcNetDescription'],
  'GC1-CTRL-025': ['payrollLabControlGcHolidayTitle', 'payrollLabControlGcHolidayDescription'],
  'GC1-CTRL-026': ['payrollLabControlGcEmployerCostTitle', 'payrollLabControlGcEmployerCostDescription'],
  'RETAIL-MODE-CTRL-NONNEGATIVE-GROSS': ['payrollLabControlRetailGrossTitle', 'payrollLabControlRetailGrossDescription'],
})

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function statusTone(status: ControlStatus): 'success' | 'warning' | 'danger' {
  if (status === 'PASS') return 'success'
  if (status === 'FAIL') return 'danger'
  return 'warning'
}

function statusLabel(status: ControlStatus, t: ControlTranslator): string {
  if (status === 'PASS') return t('payrollLabControlPassed')
  if (status === 'FAIL') return t('payrollLabControlFailed')
  return t('payrollLabControlWarning')
}

function detailLine(details: unknown, key: 'actual' | 'expected', t: ControlTranslator): string | null {
  if (!isRecord(details) || details[key] === undefined) return null
  const value = details[key]
  let formatted: string
  try {
    formatted = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  } catch {
    formatted = String(value)
  }
  return `${t(key === 'actual' ? 'payrollLabActual' : 'payrollLabExpected')}: ${formatted}`
}

export function PayrollLabControls({ controls, t }: { controls: readonly PayrollLabControl[]; t: ControlTranslator }) {
  const groups: readonly { status: ControlStatus; title: string; description: string }[] = [
    { status: 'FAIL', title: t('payrollLabControlGroupBlocking'), description: t('payrollLabControlGroupBlockingDescription') },
    { status: 'WARN', title: t('payrollLabControlGroupWarning'), description: t('payrollLabControlGroupWarningDescription') },
    { status: 'PASS', title: t('payrollLabControlGroupPassed'), description: t('payrollLabControlGroupPassedDescription') },
  ]

  return (
    <Surface className="min-w-0 p-4 sm:p-6">
      <SectionHeader title={t('payrollLabControls')} />
      {controls.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t('payrollLabNoControls')}</p> : (
        <div className="mt-4 space-y-5">
          {groups.map((group) => {
            const entries = controls.filter((control) => control.status === group.status)
            if (entries.length === 0) return null
            return (
              <section aria-label={group.title} className="min-w-0" key={group.status}>
                <div className="border-b border-border-subtle pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <span className="text-xs text-muted-foreground">{entries.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                </div>
                <ul className="divide-y divide-border-subtle">
                  {entries.map((control) => {
                    const copy = CONTROL_COPY[control.key]
                    const actual = detailLine(control.details, 'actual', t)
                    const expected = detailLine(control.details, 'expected', t)
                    return (
                      <li className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between" key={control.key}>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-foreground">{copy ? t(copy[0]) : control.key}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t(copy?.[1] ?? 'payrollLabControlGenericDescription')}</p>
                          <code className="mt-1 block break-all text-[0.7rem] text-muted-foreground">{control.key}</code>
                          {actual || expected ? <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{[actual, expected].filter(Boolean).join(' · ')}</p> : null}
                        </div>
                        <Badge className="shrink-0 self-start" tone={statusTone(control.status)}>{statusLabel(control.status, t)}</Badge>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Surface>
  )
}
