import Link from 'next/link'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from '@/lib/payroll/calculation-repository'
import type { PayrollJson, PayrollComponentResultRow } from '@/lib/payroll/database'
import type { PayrollProfessionalRun } from '@/lib/payroll/payroll-professional-service'
import {
  employerPremiumExplanations,
  payrollExplanationArray,
  payrollExplanationRecord,
  payrollExplanationString,
  payrollFiscalBases,
  payrollPensionCalculationSteps,
  payrollTraceStepByCode,
  payrollTraceSteps,
  type PayrollExplanationRecord,
} from '@/lib/payroll/payroll-professional-explanations'
import { PayrollComparisonForm, type PayrollComparisonLine } from './payroll-comparison-form'

export function formatPayrollMoney(amount: number | null, locale: string): string {
  if (amount === null || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
}

export function componentAmount(row: PayrollComponentResultRow): number | null {
  if (typeof row.amount === 'number' && Number.isFinite(row.amount)) return row.amount
  const payload = asRecord(row.result_payload)
  const amount = payload?.amount
  if (typeof amount === 'number' && Number.isFinite(amount)) return amount
  if (typeof amount === 'string' && /^-?\d{1,12}(?:\.\d{1,4})?$/.test(amount)) return Number(amount)
  return null
}

function asRecord(value: PayrollJson): Record<string, PayrollJson | undefined> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, PayrollJson | undefined>
    : null
}

function humanize(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toLocaleUpperCase())
}

function componentLabel(row: PayrollComponentResultRow, labels: Readonly<Record<string, string>>): string {
  return labels[row.component_key] ?? humanize(row.component_key)
}

function traceValue(value: PayrollJson | undefined, locale: string): string {
  const record = payrollExplanationRecord(value)
  if (record && Object.hasOwn(record, 'value')) {
    const raw = record.value
    const valueType = payrollExplanationString(record.valueType)
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (valueType === 'MONEY') return formatPayrollMoney(raw, locale)
      if (valueType === 'PERCENTAGE') return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(raw)}%`
      return String(raw)
    }
    if (typeof raw === 'string') {
      if (valueType === 'MONEY' && /^-?\d{1,12}(?:\.\d{1,4})?$/.test(raw)) return formatPayrollMoney(Number(raw), locale)
      if (valueType === 'PERCENTAGE' && /^-?\d{1,4}(?:\.\d{1,4})?$/.test(raw)) {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(raw))}%`
      }
      return raw
    }
    if (typeof raw === 'boolean') return raw ? 'true' : 'false'
    return raw === null || raw === undefined ? '—' : JSON.stringify(raw)
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  return '—'
}

function formatStoredMoney(value: PayrollJson | undefined, locale: string, missing: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') return missing
  const source = String(value)
  if (!/^-?\d{1,12}(?:\.\d{1,4})?$/.test(source)) return missing
  return formatPayrollMoney(Number(source), locale)
}

function formatStoredPercentage(value: PayrollJson | undefined, locale: string, missing: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') return missing
  const source = String(value)
  if (!/^-?\d{1,4}(?:\.\d{1,4})?$/.test(source)) return missing
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(source))}%`
}

function pensionTraceValue(name: string, value: PayrollJson | undefined, locale: string, missing: string): string {
  if (name === 'rate' || name.toLowerCase().includes('percent')) return formatStoredPercentage(value, locale, missing)
  if (/salary|franchise|pensionablebase|monthlytotal/i.test(name)) return formatStoredMoney(value, locale, missing)
  return traceValue(value, locale)
}

function traceRecordEntries(value: PayrollJson | undefined): readonly [string, PayrollJson | undefined][] {
  const record = payrollExplanationRecord(value)
  return record ? Object.entries(record) : []
}

function roundingDetails(
  tracePayload: PayrollJson | null | undefined,
  componentCode: string,
  outputName: string | null,
  componentRounding: PayrollExplanationRecord | null,
  step: PayrollExplanationRecord | null,
  roundingFallback: string | null,
  labels: Readonly<Record<string, string>>,
): readonly string[] {
  if (componentRounding) {
    const mode = payrollExplanationString(componentRounding.mode) ?? labels.notRecorded
    const scale = componentRounding.scale
    return [scale === undefined ? mode : `${mode} · ${labels.decimalPlaces} ${traceValue(scale, 'en-US')}`]
  }

  const payload = payrollExplanationRecord(tracePayload ?? undefined)
  const definitions = payrollExplanationArray(payload?.definitions)
    .map((value) => payrollExplanationRecord(value))
    .filter((value): value is PayrollExplanationRecord => value !== null)
  const definition = definitions.find((value) => value.code === componentCode)
  const outputs = payrollExplanationArray(definition?.outputs)
    .map((value) => payrollExplanationRecord(value))
    .filter((value): value is PayrollExplanationRecord => value !== null)
  const output = outputs.find((value) => value.name === outputName) ?? outputs[0]
  const definitionRounding = payrollExplanationRecord(output?.rounding)
  if (definitionRounding) {
    const mode = payrollExplanationString(definitionRounding.mode) ?? labels.notRecorded
    const scale = definitionRounding.scale
    return [scale === undefined ? mode : `${mode} · ${labels.decimalPlaces} ${traceValue(scale, 'en-US')}`]
  }

  const rules = payrollExplanationArray(payload?.roundingDefinitions)
    .map((value) => payrollExplanationRecord(value))
    .filter((value): value is PayrollExplanationRecord => value !== null && value.componentCode === componentCode)
  if (rules.length > 0) return rules.map((rule) => {
    const mode = payrollExplanationString(rule.mode) ?? labels.notRecorded
    const stage = payrollExplanationString(rule.stage)
    const places = rule.decimalPlaces === undefined ? null : traceValue(rule.decimalPlaces, 'en-US')
    const reference = payrollExplanationRecord(rule.provenance)
    return `${stage ? `${stage}: ` : ''}${mode}${places === null ? '' : ` · ${labels.decimalPlaces} ${places}`}${payrollExplanationString(reference?.sourceReference) ? ` · ${payrollExplanationString(reference?.sourceReference)}` : ''}`
  })
  const pensionRounding = roundingFallback ?? payrollExplanationString(step?.roundingRule)
  return pensionRounding ? [pensionRounding] : [labels.notRecorded]
}

function dependencyLabel(value: PayrollJson, labels: Readonly<Record<string, string>>): string {
  const dependency = payrollExplanationRecord(value)
  const code = payrollExplanationString(dependency?.componentCode)
  return code ? `${labels[code] ?? humanize(code)} · ${code}` : humanize(JSON.stringify(value))
}

function traceRuleSource(tracePayload: PayrollJson | null | undefined): string | null {
  const payload = payrollExplanationRecord(tracePayload ?? undefined)
  const metadata = payrollExplanationRecord(payload?.packageMetadata)
  const source = payrollExplanationRecord(metadata?.sourceMetadata)
  const publisher = payrollExplanationString(source?.publisher)
  const title = payrollExplanationString(source?.handbookTitle)
  return [publisher, title].filter((value): value is string => value !== null).join(' · ') || null
}

function traceComponentDefinition(
  tracePayload: PayrollJson | null | undefined,
  componentCode: string,
): PayrollExplanationRecord | null {
  const payload = payrollExplanationRecord(tracePayload ?? undefined)
  return payrollExplanationArray(payload?.definitions)
    .map((value) => payrollExplanationRecord(value))
    .find((definition) => definition?.code === componentCode) ?? null
}

function dependencyReferenceLabel(value: PayrollJson, labels: Readonly<Record<string, string>>): string {
  const dependency = payrollExplanationRecord(value)
  if (!dependency) return dependencyLabel(value, labels)
  const inputName = payrollExplanationString(dependency.inputName)
  const outputName = payrollExplanationString(dependency.outputName)
  const code = payrollExplanationString(dependency.componentCode)
  const input = inputName ? labels[inputName] ?? humanize(inputName) : null
  const source = code ? `${labels[code] ?? humanize(code)} · ${code}` : null
  const output = outputName ? `.${outputName}` : ''
  return [input && source ? `${input} ← ${source}${output}` : source ?? input].filter(Boolean).join('')
    || dependencyLabel(value, labels)
}

function traceStepProvenance(step: PayrollExplanationRecord, labels: Readonly<Record<string, string>>): string {
  const componentId = payrollExplanationString(step.componentId)
  const sequence = typeof step.sequence === 'number' && Number.isInteger(step.sequence) ? step.sequence : null
  const scope = payrollExplanationString(step.processingScope)
  return [componentId, sequence === null ? null : `${labels.traceStep} ${sequence}`, scope]
    .filter((value): value is string => value !== null).join(' · ') || labels.notRecorded
}

function componentFormula(code: string, labels: Readonly<Record<string, string>>): string | null {
  const formulaKeys: Readonly<Record<string, string>> = {
    NL_REGULAR_WAGE: 'formulaGrossWage',
    NL_TAXABLE_WAGE: 'formulaTaxableWage',
    NL_WAGE_TAX: 'formulaWageTaxTable',
    PAYRUN01_EMPLOYER_INSURANCE: 'formulaEmployerInsurance',
    PAYRUN01_NET_PAY: 'formulaNetPay',
    PAYRUN01_HOLIDAY_RESERVE: 'formulaReserve',
    PAYRUN01_YEAR_END_RESERVE: 'formulaReserve',
    PAYRUN01_CUMULATIVE_HOLIDAY_RESERVE: 'formulaCumulative',
    PAYRUN01_CUMULATIVE_YEAR_END_RESERVE: 'formulaCumulative',
    PAYRUN01_TOTAL_EMPLOYER_COST: 'formulaTotalEmployerCost',
  }
  const key = formulaKeys[code]
  return key ? labels[key] ?? null : null
}

function PayrollComponentDetail({
  row,
  step,
  pensionStep,
  tracePayload,
  locale,
  labels,
}: {
  readonly row: PayrollComponentResultRow
  readonly step: PayrollExplanationRecord | null
  readonly pensionStep: PayrollExplanationRecord | null
  readonly tracePayload: PayrollJson | null | undefined
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}) {
  const resultPayload = payrollExplanationRecord(row.result_payload)
  const component = payrollExplanationRecord(resultPayload?.component)
  const componentCode = payrollExplanationString(component?.code)
    ?? payrollExplanationString(resultPayload?.componentCode)
    ?? row.component_key
  const componentVersion = payrollExplanationString(component?.version)
    ?? payrollExplanationString(step?.version)
  const roundingMeta = payrollExplanationRecord(component?.rounding)
  const stepInputs = payrollExplanationRecord(step?.inputs)
  const stepOutputs = payrollExplanationRecord(step?.outputs)
  const packageProvenance = payrollExplanationRecord(step?.rulePackageProvenance)
  const formula = payrollExplanationString(step?.formula) ?? componentFormula(componentCode, labels)
  const effectiveFrom = payrollExplanationString(component?.effectiveFrom)
  const effectiveTo = payrollExplanationString(component?.effectiveTo)
  const processingScope = payrollExplanationString(component?.processingScope)
  const dependencies = payrollExplanationArray(step?.dependencyRefs)
  const roundingText = roundingDetails(
    tracePayload,
    componentCode,
    payrollExplanationString(resultPayload?.outputName),
    roundingMeta,
    step,
    payrollExplanationString(pensionStep?.roundingRule),
    labels,
  )

  return <details className="group rounded-lg border border-border-subtle px-3 py-2">
    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 break-words">{componentLabel(row, labels)}</span>
      <span className="shrink-0 text-right font-medium tabular-nums">{formatPayrollMoney(componentAmount(row), locale)}</span>
      <span className="col-span-2 text-xs text-muted-foreground">{labels.expandCalculation}</span>
    </summary>
    <div className="mt-3 space-y-3 border-t border-border-subtle pt-3 text-sm">
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.componentCode}</dt><dd className="break-all font-mono text-xs">{componentCode}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.componentVersion}</dt><dd className="break-all font-mono text-xs">{componentVersion ?? labels.notRecorded}</dd></div>
        {effectiveFrom || effectiveTo ? <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.effectivePeriod}</dt><dd>{effectiveFrom ?? '—'} – {effectiveTo ?? '—'}</dd></div> : null}
        {processingScope ? <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.processingScope}</dt><dd>{labels[processingScope] ?? processingScope}</dd></div> : null}
      </dl>
      {step ? <>
        {formula ? <p className="break-words"><span className="font-medium">{labels.formula}: </span>{formula}</p> : pensionStep ? null : <p className="text-xs text-muted-foreground">{labels.formulaNotRecorded}</p>}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.assessmentInputs}</h4>
          {Object.keys(stepInputs ?? {}).length > 0
            ? <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">{traceRecordEntries(stepInputs as PayrollJson | undefined).map(([name, input]) => <div key={name} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels[name] ?? humanize(name)}</dt><dd className="break-words font-medium tabular-nums">{traceValue(input, locale)}</dd></div>)}</dl>
            : pensionStep ? null : <p className="mt-2 text-xs text-muted-foreground">{labels.noPersistedInputs}</p>}
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.savedResult}</h4>
          {Object.keys(stepOutputs ?? {}).length > 0
            ? <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">{traceRecordEntries(stepOutputs as PayrollJson | undefined).map(([name, output]) => <div key={name} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels[name] ?? humanize(name)}</dt><dd className="break-words font-medium tabular-nums">{traceValue(output, locale)}</dd></div>)}</dl>
            : null}
        </div>
      </> : <p className="text-xs text-muted-foreground">{labels.noComponentTrace}</p>}
      {pensionStep ? <div className="rounded-lg bg-surface-subtle p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.pensionCalculationDetail}</h4>
        <p className="mt-2 break-words"><span className="font-medium">{labels.formula}: </span>{payrollExplanationString(pensionStep.formula) ?? labels.notRecorded}</p>
        <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {payrollExplanationString(pensionStep.assessmentBase) ? <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.assessmentBase}</dt><dd className="break-words font-medium tabular-nums">{formatStoredMoney(pensionStep.assessmentBase, locale, labels.notRecorded)}</dd></div> : null}
          {payrollExplanationString(pensionStep.rate) ? <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.percentage}</dt><dd className="break-words font-medium tabular-nums">{formatStoredPercentage(pensionStep.rate, locale, labels.notRecorded)}</dd></div> : null}
          <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.savedResult}</dt><dd className="break-words font-medium tabular-nums">{formatStoredMoney(pensionStep.result, locale, labels.notRecorded)}</dd></div>
          <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.roundingMethod}</dt><dd className="break-words">{payrollExplanationString(pensionStep.roundingRule) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.calculationSource}</dt><dd className="break-words">{payrollExplanationString(pensionStep.source) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{labels.ruleProvenance}</dt><dd className="break-all">{payrollExplanationString(payrollExplanationRecord(pensionStep.ruleProvenance)?.status) ?? labels.notRecorded}</dd></div>
        </dl>
      </div> : null}
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.roundingMethod}</dt><dd className="space-y-1">{roundingText.map((detail, index) => <p key={`${componentCode}-rounding-${index}`} className="break-words">{detail}</p>)}</dd></div>
        {step ? <>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.rulePackage}</dt><dd className="break-words">{payrollExplanationString(packageProvenance?.packageId) ?? labels.notRecorded}{packageProvenance?.version ? ` · ${payrollExplanationString(packageProvenance.version)}` : ''} · {labels.componentVersion} {payrollExplanationString(step.version) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.ruleSource}</dt><dd className="break-words">{traceRuleSource(tracePayload) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.calculationProvenance}</dt><dd className="break-all font-mono text-xs">{traceStepProvenance(step, labels)}</dd></div>
        </> : null}
        {dependencies.length > 0 ? <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">{labels.dependencies}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{dependencies.map((dependency, index) => <span key={`${dependencyLabel(dependency, labels)}-${index}`} className="break-all rounded bg-surface-subtle px-2 py-1 font-mono text-[0.7rem]">{dependencyLabel(dependency, labels)}</span>)}</dd></div> : null}
      </dl>
    </div>
  </details>
}

function EmployerPremiumBreakdown({
  tracePayload,
  locale,
  labels,
}: {
  readonly tracePayload: PayrollJson | null | undefined
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}) {
  const premiums = employerPremiumExplanations(tracePayload)
  if (premiums.length === 0) return null
  return <details className="rounded-lg border border-border-subtle px-3 py-2">
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus">{labels.employerPremiumBreakdown}</summary>
    <ul className="mt-2 divide-y divide-border-subtle">{premiums.map((premium) => {
      const step = premium.step
      const packageProvenance = payrollExplanationRecord(step.rulePackageProvenance)
      const definition = traceComponentDefinition(tracePayload, premium.code)
      const dependencies = payrollExplanationArray(step.dependencyRefs)
      const effectiveFrom = payrollExplanationString(definition?.effectiveFrom)
      const effectiveTo = payrollExplanationString(definition?.effectiveTo)
      return <li key={premium.code} className="py-3 first:pt-1">
        <details>
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-3 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 break-words">{labels[premium.labelKey] ?? premium.key.toLocaleUpperCase()}</span>
            <span className="shrink-0 text-right font-medium tabular-nums">{formatStoredMoney(premium.amount, locale, labels.notRecorded)}</span>
          </summary>
          <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.componentCode}</dt><dd className="break-all font-mono">{premium.code}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.componentVersion}</dt><dd className="break-all font-mono">{payrollExplanationString(step.version) ?? labels.notRecorded}</dd></div>
            {effectiveFrom || effectiveTo ? <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.effectivePeriod}</dt><dd className="break-words">{effectiveFrom ?? '—'} – {effectiveTo ?? '—'}</dd></div> : null}
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.assessmentBase}</dt><dd className="break-words font-medium tabular-nums">{formatStoredMoney(premium.assessmentBase, locale, labels.notRecorded)}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.percentage}</dt><dd className="break-words font-medium tabular-nums">{formatStoredPercentage(premium.rate, locale, labels.notRecorded)}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.formula}</dt><dd className="break-words">{payrollExplanationString(step.formula) ?? labels.assessmentBaseTimesRate}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.rulePackage}</dt><dd className="break-words">{payrollExplanationString(packageProvenance?.packageId) ?? labels.notRecorded} · {payrollExplanationString(packageProvenance?.version) ?? labels.notRecorded}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.ruleSource}</dt><dd className="break-words">{traceRuleSource(tracePayload) ?? labels.notRecorded}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.calculationProvenance}</dt><dd className="break-all font-mono">{traceStepProvenance(step, labels)}</dd></div>
            <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.roundingMethod}</dt><dd className="space-y-1">{roundingDetails(tracePayload, premium.code, 'amount', null, step, null, labels).map((detail, index) => <p key={`${premium.code}-rounding-${index}`} className="break-words">{detail}</p>)}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="break-words text-muted-foreground">{labels.dependencies}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{dependencies.length > 0 ? dependencies.map((dependency, index) => <span key={`${premium.code}-dependency-${index}`} className="break-all rounded bg-surface-subtle px-2 py-1 font-mono">{dependencyReferenceLabel(dependency, labels)}</span>) : labels.notRecorded}</dd></div>
          </dl>
        </details>
      </li>
    })}</ul>
  </details>
}

function PensionCalculationTrace({
  sourcePayload,
  locale,
  labels,
}: {
  readonly sourcePayload: PayrollJson
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}) {
  const steps = payrollPensionCalculationSteps(sourcePayload)
  if (steps.length === 0) return null
  return <details className="rounded-xl border border-border-subtle p-4">
    <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.pensionCalculationDetail}</summary>
    <ol className="mt-3 divide-y divide-border-subtle">{steps.map((step, index) => {
      const code = payrollExplanationString(step.componentCode) ?? `step-${index + 1}`
      const inputs = payrollExplanationRecord(step.inputs)
      const provenance = payrollExplanationRecord(step.ruleProvenance)
      const ruleReference = payrollExplanationString(provenance?.reference)
      const dependencies = payrollExplanationArray(step.dependencies)
      return <li key={`${code}-${index}`} className="min-w-0 py-4 first:pt-0 last:pb-0">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><p className="font-semibold">{labels[`pension_${code}`] ?? humanize(code)}</p><code className="break-all text-xs text-muted-foreground">{code}</code></div>
          <p className="shrink-0 text-left font-semibold tabular-nums sm:text-right">{code.includes('RATE') ? formatStoredPercentage(step.result, locale, labels.notRecorded) : formatStoredMoney(step.result, locale, labels.notRecorded)}</p>
        </div>
        {payrollExplanationString(step.formula) ? <p className="mt-2 break-words text-sm"><span className="font-medium">{labels.formula}: </span>{payrollExplanationString(step.formula)}</p> : null}
        <dl className="mt-3 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          {payrollExplanationString(step.assessmentBase) ? <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.assessmentBase}</dt><dd className="break-words font-medium tabular-nums">{formatStoredMoney(step.assessmentBase, locale, labels.notRecorded)}</dd></div> : null}
          {payrollExplanationString(step.rate) ? <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.percentage}</dt><dd className="break-words font-medium tabular-nums">{formatStoredPercentage(step.rate, locale, labels.notRecorded)}</dd></div> : null}
          {Object.entries(inputs ?? {}).map(([name, input]) => <div key={name} className="min-w-0"><dt className="break-words text-muted-foreground">{labels[name] ?? humanize(name)}</dt><dd className="break-words font-medium tabular-nums">{pensionTraceValue(name, input, locale, labels.notRecorded)}</dd></div>)}
          {payrollExplanationString(step.unroundedValue) ? <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.unroundedValue}</dt><dd className="break-words font-medium tabular-nums">{pensionTraceValue(code, step.unroundedValue, locale, labels.notRecorded)}</dd></div> : null}
          <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.roundingMethod}</dt><dd className="break-words">{payrollExplanationString(step.roundingRule) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.calculationSource}</dt><dd className="break-words">{payrollExplanationString(step.source) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.componentVersion}</dt><dd className="break-all font-mono">{payrollExplanationString(step.componentVersion) ?? labels.notRecorded}</dd></div>
          <div className="min-w-0"><dt className="break-words text-muted-foreground">{labels.ruleProvenance}</dt><dd className="break-all">{payrollExplanationString(provenance?.status) ?? labels.notRecorded}</dd></div>
          {ruleReference ? <div className="min-w-0 sm:col-span-2"><dt className="break-words text-muted-foreground">{labels.ruleReference}</dt><dd className="break-words">{ruleReference}</dd></div> : null}
          {dependencies.length > 0 ? <div className="min-w-0 sm:col-span-2"><dt className="break-words text-muted-foreground">{labels.dependencies}</dt><dd className="break-all font-mono">{dependencies.map((dependency) => traceValue(dependency, locale)).join(', ')}</dd></div> : null}
        </dl>
      </li>
    })}</ol>
  </details>
}

export function runComponentLines(
  artifacts: Pick<PayrollCalculationArtifacts, 'componentResults'>,
  labels: Readonly<Record<string, string>>,
): PayrollComparisonLine[] {
  return artifacts.componentResults
    .map((row) => ({ key: row.component_key, label: componentLabel(row, labels), amount: componentAmount(row) }))
    .filter((row) => row.amount !== null)
}

const PERSONAL_FIELDS = /bsn|burgerservicenummer|iban|bank|credential|password|secret|token|email|phone|address|birth|nationality/i

export function sanitizePayrollTrace(value: PayrollJson): PayrollJson | undefined {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePayrollTrace(entry)).filter((entry): entry is PayrollJson => entry !== undefined)
  }
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (PERSONAL_FIELDS.test(key) || entry === undefined) return []
    const sanitized = sanitizePayrollTrace(entry)
    return sanitized === undefined ? [] : [[key, sanitized]]
  }))
}

export function PayrollRunSummaryList({
  runs,
  labels,
}: {
  readonly runs: readonly PayrollRunSummary[]
  readonly labels: Readonly<Record<string, string>>
}) {
  if (runs.length === 0) return <p className="rounded-xl border border-dashed border-border-subtle p-6 text-sm text-muted-foreground">{labels.empty}</p>
  return <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border-subtle">
    <ul className="divide-y divide-border-subtle sm:hidden">{runs.map((summary) => <li key={summary.run.id} className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium tabular-nums">{summary.payrollPeriod.period_year}-{String(summary.payrollPeriod.period_month).padStart(2, '0')}</span><span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs">{labels[`run_${summary.run.status}`] ?? summary.run.status}</span></div>
      <p className="text-sm">{labels.employee} <span className="ml-1 font-mono text-xs text-muted-foreground">{summary.sourceSnapshot.source_employee_id.slice(-8)}</span></p>
      <p className="break-all font-mono text-xs text-muted-foreground">{summary.run.id}</p>
      <Link className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/payroll/runs/${encodeURIComponent(summary.run.id)}`}>{labels.openDetail}</Link>
    </li>)}</ul>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr>
          <th className="px-4 py-3">{labels.period}</th><th className="px-4 py-3">{labels.employee}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.runId}</th><th className="px-4 py-3">{labels.action}</th>
        </tr></thead>
        <tbody className="divide-y divide-border-subtle">{runs.map((summary) => <tr key={summary.run.id}>
            <td className="whitespace-nowrap px-4 py-3 tabular-nums">{summary.payrollPeriod.period_year}-{String(summary.payrollPeriod.period_month).padStart(2, '0')}</td>
            <td className="px-4 py-3"><span>{labels.employee}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{summary.sourceSnapshot.source_employee_id.slice(-8)}</span></td>
            <td className="px-4 py-3">{labels[`run_${summary.run.status}`] ?? summary.run.status}</td>
            <td className="max-w-44 break-all px-4 py-3 font-mono text-xs text-muted-foreground">{summary.run.id}</td>
            <td className="px-4 py-3"><Link className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/payroll/runs/${encodeURIComponent(summary.run.id)}`}>{labels.openDetail}</Link></td>
          </tr>)}</tbody>
      </table>
    </div>
    <p className="border-t border-border-subtle px-4 py-3 text-xs text-muted-foreground">{labels.runHashesHint}</p>
  </div>
}

export function PayrollRunReconciliation({
  run,
  locale,
  labels,
}: {
  readonly run: PayrollProfessionalRun
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}) {
  const components = run.componentResults
  const byKey = new Map(components.map((row) => [row.component_key, row]))
  const tracePayload = run.trace?.trace_payload
  const engineSteps = payrollTraceSteps(tracePayload)
  const pensionSteps = payrollPensionCalculationSteps(run.sourceSnapshot.source_payload)
  const fiscalBases = payrollFiscalBases(run.sourceSnapshot.source_payload)
  const payrollOwned = payrollExplanationRecord(payrollExplanationRecord(run.sourceSnapshot.source_payload)?.payrollOwned)
  const pensionSummary = payrollExplanationRecord(payrollOwned?.pensionCalculationSummary)
  const groups = [
    { title: labels.employeeArithmetic, keys: ['contractual_salary', 'additional_cash_amount', 'additional_hours_pay', 'gross_salary', 'employee_pension', 'taxable_wage', 'employee_insurance_wage', 'zvw_wage', 'wage_tax', 'net_salary'] },
    { title: labels.employerCost, keys: ['employer_insurance', 'employer_pension', 'holiday_allowance_reserve', 'holiday_reserve', 'year_end_reserve', 'total_employer_cost'] },
    { title: labels.cumulative, keys: ['cumulative_gross', 'cumulative_holiday_reserve', 'cumulative_year_end_reserve'] },
  ]
  const renderRow = (row: PayrollComponentResultRow) => {
    const resultPayload = payrollExplanationRecord(row.result_payload)
    const component = payrollExplanationRecord(resultPayload?.component)
    const code = payrollExplanationString(component?.code) ?? payrollExplanationString(resultPayload?.componentCode)
    const pensionStepCode = row.component_key === 'employee_pension'
      ? 'PENSION_EMPLOYEE_SHARE'
      : row.component_key === 'employer_pension' ? 'PENSION_EMPLOYER_SHARE' : null
    const pensionStep = pensionStepCode ? pensionSteps.find((step) => step.componentCode === pensionStepCode) ?? null : null
    return <div key={row.component_key} className="border-t border-border-subtle py-3 first:border-t-0">
      <PayrollComponentDetail row={row} step={payrollTraceStepByCode(engineSteps, code)} pensionStep={pensionStep} tracePayload={tracePayload} locale={locale} labels={labels} />
      {row.component_key === 'employer_insurance' ? <div className="mt-3"><EmployerPremiumBreakdown tracePayload={tracePayload} locale={locale} labels={labels} /></div> : null}
    </div>
  }
  const succeeded = run.run.status === 'SUCCEEDED'
  const gross = byKey.has('gross_salary') ? componentAmount(byKey.get('gross_salary')!) : null
  const net = byKey.has('net_salary') ? componentAmount(byKey.get('net_salary')!) : null
  const finalized = run.lifecycleEvents.some((event) => event.calculation_run_id === run.run.id && event.event_type === 'FINALIZED')
  const concept = run.lifecycleEvents.some((event) => event.calculation_run_id === run.run.id && event.event_type === 'CONCEPT')
  const pensionReadinessWarning = run.controls.some((control) => control.status === 'WARN' && /PENSION-RULE-READY/i.test(control.control_key))
  const pensionMissing = !byKey.has('employee_pension') && !byKey.has('employer_pension') && pensionSteps.length === 0 && !pensionSummary
  const savedState = finalized ? labels.finalizedStatus : concept ? labels.conceptStatus : succeeded ? labels.notFinalized : labels.notSucceeded

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4"><p className="text-xs text-muted-foreground">{labels.gross}</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPayrollMoney(gross, locale)}</p></div>
      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4"><p className="text-xs text-muted-foreground">{labels.net}</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPayrollMoney(net, locale)}</p></div>
    </div>
    <p className={`rounded-lg border px-4 py-3 text-sm font-medium ${finalized ? 'border-border-subtle bg-surface-subtle' : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'}`}>{savedState}</p>
    {pensionReadinessWarning ? <div role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"><p className="font-semibold">{labels.pensionReadinessTitle}</p><p className="mt-1">{pensionSteps.length > 0 ? labels.pensionReadinessWarning : labels.pensionSourceVerificationRequired}</p>{pensionMissing ? <p className="mt-1 font-medium">{labels.netNotDefinitive}</p> : null}</div> : pensionMissing ? <div role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"><p className="font-semibold">{labels.pensionSourceVerificationRequired}</p><p className="mt-1 font-medium">{labels.netNotDefinitive}</p></div> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      <p className="break-all rounded-lg bg-surface-subtle p-3 text-xs"><span className="font-semibold">{labels.sourceHash}: </span><code>{run.sourceSnapshot.source_hash}</code></p>
      <p className="break-all rounded-lg bg-surface-subtle p-3 text-xs"><span className="font-semibold">{labels.inputHash}: </span><code>{run.inputSet.input_hash}</code></p>
      <p className="break-all rounded-lg bg-surface-subtle p-3 text-xs"><span className="font-semibold">{labels.resultHash}: </span><code>{run.run.result_hash ?? labels.notAvailable}</code></p>
      <p className="rounded-lg bg-surface-subtle p-3 text-xs"><span className="font-semibold">{labels.engine}: </span>{run.inputSet.engine_version} · {run.inputSet.rule_package_composition_id}</p>
    </div>
    <section className="rounded-xl border border-border-subtle p-4">
      <h2 className="font-semibold">{labels.reconciliationFlow}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{labels.employeeReconciliationFormula}</p>
      <p className="mt-2 text-sm text-muted-foreground">{labels.employerReconciliationFormula}</p>
      <details className="mt-3 rounded-lg border border-border-subtle px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus">{labels.distinctFiscalBases}</summary>
      <dl className="mt-2 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">{fiscalBases.map((base) => <div key={base.key} className="min-w-0 rounded-lg bg-surface-subtle p-3"><dt className="break-words text-xs text-muted-foreground">{labels[base.labelKey]}</dt><dd className="mt-1 break-words font-medium tabular-nums">{formatStoredMoney(base.amount ?? undefined, locale, labels.notCalculated)}</dd></div>)}</dl>
      </details>
    </section>
    <div className="space-y-3">{groups.map((group) => {
      const rows = group.keys.flatMap((key) => byKey.has(key) ? [byKey.get(key)!] : [])
      if (rows.length === 0) return null
      return <details key={group.title} className="rounded-xl border border-border-subtle p-4" open>
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{group.title}</summary>
        <div className="mt-3">{rows.map(renderRow)}</div>
      </details>
    })}
      {components.filter((row) => !groups.some((group) => group.keys.includes(row.component_key))).length > 0
        ? <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.otherComponents}</summary><div className="mt-3">{components.filter((row) => !groups.some((group) => group.keys.includes(row.component_key))).map(renderRow)}</div></details>
        : null}
    </div>
    {pensionSteps.length > 0 ? <PensionCalculationTrace sourcePayload={run.sourceSnapshot.source_payload} locale={locale} labels={labels} /> : null}
    <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.controls}</summary>
      <ul className="mt-3 divide-y divide-border-subtle">{run.controls.map((control) => <li key={control.control_key} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{labels[control.control_key] ?? humanize(control.control_key)}</span><span className="font-medium">{labels[`control_${control.status}`] ?? control.status}</span><pre className="w-full overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(sanitizePayrollTrace(control.detail_payload), null, 2)}</pre></li>)}</ul>
    </details>
    {run.trace ? <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.calculationTrace}</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-subtle p-3 text-xs">{JSON.stringify(sanitizePayrollTrace(run.trace.trace_payload), null, 2)}</pre></details> : null}
    <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.lifecycle}</summary><ol className="mt-3 space-y-2">{run.lifecycleEvents.filter((event) => event.calculation_run_id === run.run.id).map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-3 text-sm"><span>{labels[`event_${event.event_type}`] ?? event.event_type}</span><time dateTime={event.created_at} className="text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</time></li>)}</ol></details>
    <p className="text-sm text-muted-foreground">{succeeded ? finalized ? labels.finalized : labels.notFinalized : labels.notSucceeded}</p>
    <div className="flex flex-wrap gap-3">
      {finalized ? <><Link className="rounded-md border border-border-subtle px-3 py-2 text-sm font-medium text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={`/api/payroll/runs/${encodeURIComponent(run.run.id)}/artifact/TECHNICAL_JSON`}>{labels.downloadJson}</Link><Link className="rounded-md border border-border-subtle px-3 py-2 text-sm font-medium text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={`/api/payroll/runs/${encodeURIComponent(run.run.id)}/artifact/PAYSLIP_PDF`}>{labels.downloadPdf}</Link></> : null}
      <Link className="rounded-md border border-border-subtle px-3 py-2 text-sm font-medium text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={`/payroll/compare?run=${encodeURIComponent(run.run.id)}`}>{labels.compare}</Link>
    </div>
  </div>
}

export function PayrollManualComparison({ artifacts, labels }: {
  readonly artifacts: PayrollCalculationArtifacts
  readonly labels: Readonly<Record<string, string>>
}) {
  const lines = runComponentLines(artifacts, labels)
  return <PayrollComparisonForm lines={lines} labels={{
    component: labels.component,
    liquidHr: labels.liquidHr,
    external: labels.external,
    difference: labels.difference,
    exact: labels.exact,
    cent: labels.cent,
    larger: labels.larger,
    invalid: labels.manualComparisonHint,
  }} />
}
