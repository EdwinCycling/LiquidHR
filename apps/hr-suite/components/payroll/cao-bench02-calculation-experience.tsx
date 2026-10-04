import Link from 'next/link'
import { Download, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { SectionHeader } from '@/components/patterns/section-header'
import { PayrollGrossOnlyConceptSlip, type PayrollGrossOnlyConceptSlipData, type PayrollGrossOnlyConceptSlipTranslator } from '@/components/payroll/gross-only-concept-slip'
import {
  getCaoBench02H1Examples,
  getCaoBench02RuleMetadata,
  CAO_BENCH02_CALCULATION_CASES,
  type CaoBench02CalculationCaseKey,
  type CaoBench02CaseKey,
} from '@/lib/payroll/cao-bench02-calculation-service'
import type { PayrollJson } from '@/lib/payroll/database'
import type { SyntheticPayrollView } from '@/lib/payroll/synthetic-calculation-service'
import { formatPayrollMoneyForDisplay } from '@/app/(dashboard)/payroll-lab/format-money'
import { runCaoBench02PayrollAction } from '@/app/(dashboard)/payroll-lab/actions'

type Props = {
  caseKey: CaoBench02CaseKey
  canRun: boolean
  latest: SyntheticPayrollView | null
  errorMessage: string | null
  locale: string
  administrationName: string
  t: PayrollGrossOnlyConceptSlipTranslator
}

type ResultRow = {
  key: string
  labelKey: string
}

const RESULT_ROWS: Readonly<Record<CaoBench02CalculationCaseKey, readonly ResultRow[]>> = Object.freeze({
  'CAO-BENCH02-K1': [
    { key: 'full_time_monthly_salary', labelKey: 'payrollLabBenchResultFullTimeMonthly' },
    { key: 'base_salary', labelKey: 'payrollLabBenchResultBaseSalary' },
    { key: 'hourly_salary', labelKey: 'payrollLabBenchResultHourlySalary' },
    { key: 'work_hour_supplement', labelKey: 'payrollLabBenchResultWorkHourSupplement' },
    { key: 'gross_salary', labelKey: 'payrollLabBenchResultGross' },
  ],
  'CAO-BENCH02-K2': [
    { key: 'full_time_monthly_salary', labelKey: 'payrollLabBenchResultFullTimeMonthly' },
    { key: 'base_salary', labelKey: 'payrollLabBenchResultBaseSalary' },
    { key: 'hourly_salary', labelKey: 'payrollLabBenchResultHourlySalary' },
    { key: 'work_hour_supplement', labelKey: 'payrollLabBenchResultWorkHourSupplement' },
    { key: 'gross_salary', labelKey: 'payrollLabBenchResultGross' },
  ],
  'CAO-BENCH02-R1': [
    { key: 'hourly_base_rate', labelKey: 'payrollLabBenchResultHourlyRate' },
    { key: 'base_monthly_gross', labelKey: 'payrollLabBenchResultBaseMonthly' },
    { key: 'gross_pay', labelKey: 'payrollLabBenchResultGross' },
  ],
  'CAO-BENCH02-R2': [
    { key: 'hourly_base_rate', labelKey: 'payrollLabBenchResultHourlyRate' },
    { key: 'base_monthly_gross', labelKey: 'payrollLabBenchResultBaseMonthly' },
    { key: 'selected_premium_gross', labelKey: 'payrollLabBenchResultPremium' },
    { key: 'gross_pay', labelKey: 'payrollLabBenchResultGross' },
  ],
  'CAO-BENCH02-B1': [
    { key: 'gross_hourly_rate', labelKey: 'payrollLabBenchResultHourlyRate' },
    { key: 'salary_band_minimum', labelKey: 'payrollLabBenchResultBandMinimum' },
    { key: 'salary_band_midpoint', labelKey: 'payrollLabBenchResultBandMidpoint' },
    { key: 'salary_band_maximum', labelKey: 'payrollLabBenchResultBandMaximum' },
    { key: 'gross_salary', labelKey: 'payrollLabBenchResultGross' },
    { key: 'compa_ratio_display', labelKey: 'payrollLabBenchResultCompaRatio' },
    { key: 'band_status', labelKey: 'payrollLabBenchResultBandStatus' },
  ],
  'CAO-BENCH02-B2': [
    { key: 'gross_hourly_rate', labelKey: 'payrollLabBenchResultHourlyRate' },
    { key: 'full_time_equivalent_gross_monthly_salary', labelKey: 'payrollLabBenchResultFullTimeEquivalent' },
    { key: 'salary_band_minimum', labelKey: 'payrollLabBenchResultBandMinimum' },
    { key: 'salary_band_midpoint', labelKey: 'payrollLabBenchResultBandMidpoint' },
    { key: 'salary_band_maximum', labelKey: 'payrollLabBenchResultBandMaximum' },
    { key: 'gross_salary', labelKey: 'payrollLabBenchResultGross' },
    { key: 'compa_ratio_display', labelKey: 'payrollLabBenchResultCompaRatio' },
    { key: 'band_status', labelKey: 'payrollLabBenchResultBandStatus' },
  ],
  'CAO-BENCH02-C1': [
    { key: 'gross_salary', labelKey: 'payrollLabBenchResultGross' },
    { key: 'salary_strategy', labelKey: 'payrollLabBenchResultSalaryStrategy' },
    { key: 'salary_basis', labelKey: 'payrollLabBenchResultSalaryBasis' },
    { key: 'band_applied', labelKey: 'payrollLabBenchResultBandApplied' },
    { key: 'band_status', labelKey: 'payrollLabBenchResultCaoApplicability' },
  ],
})

function isRecord(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function payloadValue(latest: SyntheticPayrollView, key: string): { value: string | boolean; valueType: string } | null {
  const row = latest.components.find((component) => component.key === key)
  if (!row || !isRecord(row.payload)) return null
  const value = row.payload.value
  const valueType = row.payload.valueType
  if ((typeof value !== 'string' && typeof value !== 'boolean') || typeof valueType !== 'string') return null
  return { value, valueType }
}

function sourceScenario(latest: SyntheticPayrollView): { readonly [key: string]: PayrollJson | undefined } | null {
  if (!isRecord(latest.sourcePayload)) return null
  return isRecord(latest.sourcePayload.scenario) ? latest.sourcePayload.scenario : null
}

function amountValue(latest: SyntheticPayrollView, key: string): string | null {
  const value = payloadValue(latest, key)
  return value && value.valueType === 'MONEY' && typeof value.value === 'string' ? value.value : null
}

function lineKeys(caseKey: CaoBench02CalculationCaseKey): readonly { key: string; labelKey: string }[] {
  if (caseKey.startsWith('CAO-BENCH02-K')) return [
    { key: 'base_salary', labelKey: 'payrollLabBenchLineBaseSalary' },
    { key: 'work_hour_supplement', labelKey: 'payrollLabBenchLineWorkHourSupplement' },
  ]
  if (caseKey === 'CAO-BENCH02-R1') return [{ key: 'base_monthly_gross', labelKey: 'payrollLabBenchLineBaseSalary' }]
  if (caseKey === 'CAO-BENCH02-R2') return [
    { key: 'base_monthly_gross', labelKey: 'payrollLabBenchLineBaseSalary' },
    { key: 'selected_premium_gross', labelKey: 'payrollLabBenchLinePremium' },
  ]
  return [{ key: 'gross_salary', labelKey: 'payrollLabBenchLineGrossSalary' }]
}

function basisKey(caseKey: CaoBench02CalculationCaseKey): string {
  return `payrollLabBenchBasis_${caseKey.slice(-2)}`
}

function methodKey(caseKey: CaoBench02CalculationCaseKey): string {
  return `payrollLabBenchMethod_${caseKey.slice(-2)}`
}

function makeSlipData(
  caseKey: CaoBench02CalculationCaseKey,
  latest: SyntheticPayrollView,
  locale: string,
  administrationName: string,
  t: PayrollGrossOnlyConceptSlipTranslator,
): PayrollGrossOnlyConceptSlipData {
  const metadata = getCaoBench02RuleMetadata(caseKey)
  const scenario = sourceScenario(latest)
  const premiumPercent = caseKey === 'CAO-BENCH02-K2' ? '45%' : caseKey === 'CAO-BENCH02-R2' ? '50%' : undefined
  const hours = caseKey === 'CAO-BENCH02-K2'
    ? '4'
    : caseKey === 'CAO-BENCH02-R2'
      ? '2'
      : undefined
  const traceRecord = isRecord(latest.trace) ? latest.trace : null
  const definitions = traceRecord && Array.isArray(traceRecord.definitions) ? traceRecord.definitions : []
  const steps = traceRecord && Array.isArray(traceRecord.steps) ? traceRecord.steps : []
  const trace = [
    ...(scenario ? [`synthetic-inputs:\n${JSON.stringify(scenario, null, 2)}`] : []),
    `source-version-vector:\n${JSON.stringify(latest.sourceVersionVector, null, 2)}`,
    ...(definitions.length ? [`component-definitions-and-dependencies:\n${JSON.stringify(definitions, null, 2)}`] : []),
    ...steps.map((step, index) => `calculation-step-${index + 1}:\n${JSON.stringify(step, null, 2)}`),
  ]
  const grossTotalKey = caseKey.startsWith('CAO-BENCH02-K')
    ? 'gross_salary'
    : caseKey.startsWith('CAO-BENCH02-R')
      ? 'gross_pay'
      : 'gross_salary'
  const grossComponents = lineKeys(caseKey).map(({ key, labelKey }) => {
    const isPremiumComponent = key === 'work_hour_supplement' || key === 'selected_premium_gross'
    return {
      id: key,
      label: t(labelKey),
      amountLabel: formatPayrollMoneyForDisplay(amountValue(latest, key), locale),
      basisLabel: t(basisKey(caseKey)),
      methodLabel: t(methodKey(caseKey)),
      ...(isPremiumComponent && premiumPercent ? { percentageLabel: premiumPercent } : {}),
      ...(isPremiumComponent && hours ? { hoursLabel: hours } : {}),
      roundingLabel: t('payrollLabBenchDisplayRounding'),
      ruleRefs: metadata?.rules.map((rule) => `${rule.ruleKey}@${rule.ruleVersion}`) ?? [],
    }
  })
  const packageId = metadata?.packageId ?? 'CAO-BENCH02'
  const statusLabel = t('payrollLabConceptSlipStatusSucceeded')
  const total = amountValue(latest, grossTotalKey)
  const syntheticEmployeeLabel = t(metadata?.displayNameKey ?? 'payrollLabBenchEmployee')
  const arrangementName = t(metadata?.arrangementNameKey ?? 'payrollLabBenchOpenBands')
  const arrangementVersion = metadata?.arrangementVersion ?? '—'
  const ruleIds = metadata?.rules.map((rule) => `${rule.ruleKey}@${rule.ruleVersion}`) ?? []
  const sourceLinks = metadata?.sourceMetadata
    ? Object.values(metadata.sourceMetadata).filter((value): value is string => typeof value === 'string' && value.startsWith('https://'))
    : []
  const controlStrings = latest.controls.map((control) => `${control.key}:${control.status}`)
  const scenarioSummary = scenario ? Object.entries(scenario).map(([key, value]) => `${key}=${String(value)}`) : []

  return {
    caseKey,
    syntheticAdminLabel: `${t('payrollLabBenchSyntheticPrefix')} — ${administrationName}`,
    syntheticEmployeeLabel,
    periodLabel: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(latest.payrollPeriod.year, latest.payrollPeriod.month - 1, 1))),
    arrangementName,
    arrangementVersion,
    statusLabel,
    grossComponents,
    grossTotalLabel: t('payrollLabConceptSlipGrossTotal'),
    grossTotalAmountLabel: formatPayrollMoneyForDisplay(total, locale),
    ...(caseKey === 'CAO-BENCH02-K2' ? { roundingNote: t('payrollLabBenchK2TotalRoundingNote') } : {}),
    technical: {
      runId: latest.runId,
      sourceSnapshotId: latest.sourceSnapshotId,
      inputSetId: latest.inputSetId,
      packageId,
      ruleIds,
      engineVersion: latest.engineVersion,
      trace: [...scenarioSummary, ...trace, ...sourceLinks],
      hashes: { source: latest.sourceHash, input: latest.inputHash, run: latest.resultHash ?? '—' },
      controls: controlStrings,
    },
  }
}

function formatResultValue(value: { value: string | boolean; valueType: string }, locale: string, t: PayrollGrossOnlyConceptSlipTranslator): string {
  if (value.valueType === 'MONEY' && typeof value.value === 'string') {
    return `${formatPayrollMoneyForDisplay(value.value, locale)} (${value.value})`
  }
  if (value.valueType === 'PERCENTAGE' && typeof value.value === 'string') return `${value.value}%`
  if (value.valueType === 'BOOLEAN') return typeof value.value === 'boolean'
    ? value.value ? t('payrollLabBenchYes') : t('payrollLabBenchNo')
    : '—'
  return String(value.value)
}

function H1Examples({ t }: { t: PayrollGrossOnlyConceptSlipTranslator }) {
  const examples = getCaoBench02H1Examples()
  const cases = [
    { key: 'supported', labelKey: 'payrollLabBenchH1Specialist', explanationKey: 'payrollLabBenchH1ExplanationSupported', result: examples.supported },
    { key: 'excludedDirector', labelKey: 'payrollLabBenchH1Director', explanationKey: 'payrollLabBenchH1ExplanationDirector', result: examples.excludedDirector },
    { key: 'evidenceGap', labelKey: 'payrollLabBenchH1EvidenceGap', explanationKey: 'payrollLabBenchH1ExplanationEvidenceGap', result: examples.evidenceGap },
  ] as const
  return <div className="space-y-4">
    <Surface className="p-4 sm:p-6">
      <SectionHeader title={t('payrollLabBenchH1Title')} description={t('payrollLabBenchH1Description')} />
      <p className="mt-4 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 text-sm text-muted-foreground">{t('payrollLabBenchH1Warning')}</p>
      <ul className="mt-5 grid gap-3 lg:grid-cols-3">
        {cases.map(({ key, labelKey, explanationKey, result }) => (
          <li className="min-w-0 rounded-[var(--radius-control)] border border-border-subtle p-4" key={key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{t(labelKey)}</h3>
              <Badge tone={result.status === 'SUPPORTED' ? 'success' : result.status === 'EXCLUDED' ? 'neutral' : 'warning'}>{t(`payrollLabBenchH1Status_${result.status}`)}</Badge>
            </div>
            <p className="mt-3 text-sm text-foreground">{t(explanationKey)}</p>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{result.reasonCode}</p>
            {result.sourceReference ? <a className="mt-3 inline-block break-all text-xs text-primary underline underline-offset-2" href={result.sourceReference} rel="noreferrer" target="_blank">{result.sourceIdentifier}</a> : null}
          </li>
        ))}
      </ul>
    </Surface>
  </div>
}

export function CaoBench02CalculationExperience({
  caseKey, canRun, latest, errorMessage, locale, administrationName, t,
}: Props) {
  const isH1 = caseKey === 'CAO-BENCH02-H1'
  const selectedMetadata = isH1 ? null : getCaoBench02RuleMetadata(caseKey)
  const runOk = latest?.status === 'SUCCEEDED' && latest.caseKey === caseKey
  return <div className="space-y-6">
    <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/payroll-lab/calculations">{t('payrollLabBackToHistoricalCalculations')}</Link>
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('payrollLabBenchTitle')}</h1>
        <Badge tone="warning">{t('payrollLabBenchTestMark')}</Badge>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{t('payrollLabBenchDescription')}</p>
    </header>

    <nav aria-label={t('payrollLabCaseSelector')} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {CAO_BENCH02_CALCULATION_CASES.map((candidate) => {
        const metadata = getCaoBench02RuleMetadata(candidate)
        const selected = candidate === caseKey
        return <Link
          aria-current={selected ? 'page' : undefined}
          className={`${buttonClasses({ size: 'sm', variant: selected ? 'primary' : 'secondary' })} min-h-14 justify-start whitespace-normal text-left`}
          href={`/payroll-lab/calculations?case=${encodeURIComponent(candidate)}`}
          key={candidate}
        >
          <span className="font-mono text-xs">{candidate.slice(-2)}</span>
          <span>{t(metadata?.displayNameKey ?? 'payrollLabBenchTitle')}</span>
        </Link>
      })}
      <Link aria-current={isH1 ? 'page' : undefined} className={`${buttonClasses({ size: 'sm', variant: isH1 ? 'primary' : 'secondary' })} min-h-14 justify-start whitespace-normal text-left`} href="/payroll-lab/calculations?case=CAO-BENCH02-H1">
        <span className="font-mono text-xs">H1</span><span>{t('payrollLabBenchH1Title')}</span>
      </Link>
    </nav>

    {errorMessage ? <Surface className="border-destructive/40 p-4 text-sm text-destructive" role="alert">{errorMessage}</Surface> : null}
    {isH1 ? <H1Examples t={t} /> : <>
      {selectedMetadata ? <Surface className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <SectionHeader title={`${t(selectedMetadata.displayNameKey)} · ${caseKey}`} description={`${t(selectedMetadata.arrangementNameKey)} · ${selectedMetadata.arrangementVersion} · ${selectedMetadata.effectiveDate}`} />
            <p className="mt-3 text-sm text-muted-foreground">{t('payrollLabBenchSelectedAdministration')}: {administrationName} · {t('payrollLabBenchFixture')}: {selectedMetadata.fixtureCode}</p>
            {caseKey.startsWith('CAO-BENCH02-R') ? <p className="mt-4 rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 p-3 text-sm text-foreground" role="note">{t('payrollLabBenchRetailScopeNotice')}</p> : null}
          </div>
          {canRun ? <form action={runCaoBench02PayrollAction}>
            <input name="caseKey" type="hidden" value={caseKey} />
            <Button type="submit"><Play aria-hidden="true" />{t('payrollLabBenchRun')}</Button>
          </form> : null}
        </div>
      </Surface> : null}

      {!latest ? <EmptyState description={t('payrollLabBenchNoRun')} icon={<Download />} title={t('payrollLabBenchNoRunTitle')} /> : null}
      {latest && runOk ? <>
        <PayrollGrossOnlyConceptSlip data={makeSlipData(caseKey as CaoBench02CalculationCaseKey, latest, locale, administrationName, t)} t={t} />
        <Surface className="p-4 sm:p-6">
          <SectionHeader title={t('payrollLabBenchCalculationResults')} description={t('payrollLabBenchExactValuesNote')} />
          <dl className="mt-4 divide-y divide-border-subtle">
            {RESULT_ROWS[caseKey as CaoBench02CalculationCaseKey].map(({ key, labelKey }) => {
              const value = payloadValue(latest, key)
              return <div className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4" key={key}>
                <dt className="text-sm text-muted-foreground">{t(labelKey)} <code className="ml-1 text-xs">{key}</code></dt>
                <dd className="break-all text-sm font-medium tabular-nums text-foreground">{value ? formatResultValue(value, locale, t) : '—'}</dd>
              </div>
            })}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/api/payroll-lab/validation-pack?caseKey=${encodeURIComponent(caseKey)}&runId=${encodeURIComponent(latest.runId)}&format=pdf`}>
              <Download aria-hidden="true" />{t('payrollLabBenchDownloadPdf')}
            </a>
            <a className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/api/payroll-lab/validation-pack?caseKey=${encodeURIComponent(caseKey)}&runId=${encodeURIComponent(latest.runId)}&format=json`}>
              <Download aria-hidden="true" />{t('payrollLabBenchDownloadJson')}
            </a>
          </div>
        </Surface>
      </> : latest ? <Surface className="space-y-3 border-warning/50 p-4 text-sm" role="status">
        <p>{t('payrollLabBenchRunNotSuccessful')}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{t('payrollLabBenchFailedRunId')}</dt><dd className="break-all font-mono text-xs">{latest.runId}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('payrollLabBenchFailedRunCode')}</dt><dd className="font-mono text-xs">{latest.errorCode ?? latest.outcome ?? '—'}</dd></div>
        </dl>
        {latest.trace ? <details>
          <summary className="cursor-pointer font-medium underline underline-offset-2">{t('payrollLabBenchFailedRunTrace')}</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 font-mono text-xs">{JSON.stringify(latest.trace, null, 2)}</pre>
        </details> : null}
      </Surface> : null}
    </>}
  </div>
}
