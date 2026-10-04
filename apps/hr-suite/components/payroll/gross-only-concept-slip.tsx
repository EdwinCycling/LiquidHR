import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'

export type PayrollGrossOnlyComponent = {
  id: string
  label: string
  amountLabel: string
  basisLabel?: string
  methodLabel?: string
  percentageLabel?: string
  hoursLabel?: string
  roundingLabel?: string
  ruleRefs: readonly string[]
}

export type PayrollGrossOnlyTechnicalData = {
  runId: string
  sourceSnapshotId: string
  inputSetId: string
  packageId: string
  ruleIds: readonly string[]
  engineVersion: string
  trace: readonly string[]
  hashes: {
    source: string
    input: string
    run: string
  }
  controls: readonly string[]
}

export type PayrollGrossOnlyConceptSlipData = {
  caseKey: string
  syntheticAdminLabel: string
  syntheticEmployeeLabel: string
  periodLabel: string
  arrangementName: string
  arrangementVersion: string
  statusLabel: string
  grossComponents: readonly PayrollGrossOnlyComponent[]
  grossTotalLabel: string
  grossTotalAmountLabel: string
  roundingNote?: string
  technical: PayrollGrossOnlyTechnicalData
}

export type PayrollGrossOnlyConceptSlipTranslator = (key: string) => string

export type PayrollGrossOnlyConceptSlipProps = {
  data: PayrollGrossOnlyConceptSlipData
  t: PayrollGrossOnlyConceptSlipTranslator
}

function MetadataItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className={`mt-1 break-all text-sm text-foreground ${mono ? 'font-mono text-xs' : 'font-medium'}`.trim()}>{value}</dd>
  </div>
}

function NotCalculated({ label, t }: { label: string; t: PayrollGrossOnlyConceptSlipTranslator }) {
  return <div className="min-w-0 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-2"><Badge tone="neutral">{t('payrollLabConceptSlipNotCalculated')}</Badge></dd>
  </div>
}

function DetailValue({ label, value }: { label: string; value?: string }) {
  if (value === undefined || value.length === 0) return null
  return <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
  </div>
}

function TechnicalList({ title, values, emptyLabel }: { title: string; values: readonly string[]; emptyLabel: string }) {
  return <section className="min-w-0">
    <h4 className="text-xs font-semibold text-foreground">{title}</h4>
    {values.length
      ? <ul className="mt-2 space-y-3">{values.map((value, index) => <li className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground" key={`${index}:${value}`}>{value}</li>)}</ul>
      : <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>}
  </section>
}

export function PayrollGrossOnlyConceptSlip({ data, t }: PayrollGrossOnlyConceptSlipProps) {
  const { technical } = data

  return <Surface className="overflow-hidden">
    <div className="space-y-4 border-b border-border-subtle p-4 sm:p-6">
      <Badge className="whitespace-normal" tone="warning"><AlertTriangle aria-hidden="true" className="mr-1.5 size-3.5 shrink-0" />{t('payrollLabConceptSlipBanner')}</Badge>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{t('payrollLabConceptSlipTitle')}</h2>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{t('payrollLabConceptSlipCase')}: {data.caseKey}</p>
        </div>
        <Badge tone="info">{data.statusLabel}</Badge>
      </div>
    </div>

    <dl className="grid gap-x-6 gap-y-4 border-b border-border-subtle p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
      <MetadataItem label={t('payrollLabConceptSlipAdministration')} value={data.syntheticAdminLabel} />
      <MetadataItem label={t('payrollLabConceptSlipEmployee')} value={data.syntheticEmployeeLabel} />
      <MetadataItem label={t('payrollLabConceptSlipPeriod')} value={data.periodLabel} />
      <MetadataItem label={t('payrollLabConceptSlipArrangement')} value={data.arrangementName} />
      <MetadataItem label={t('payrollLabConceptSlipArrangementVersion')} value={data.arrangementVersion} />
      <MetadataItem label={t('payrollLabConceptSlipStatus')} value={data.statusLabel} />
    </dl>

    <section aria-labelledby="payroll-gross-components-heading" className="space-y-4 p-4 sm:p-6">
      <h3 className="text-base font-semibold text-foreground" id="payroll-gross-components-heading">{t('payrollLabConceptSlipGrossComponents')}</h3>
      {data.grossComponents.length
        ? <ul className="space-y-2">{data.grossComponents.map((component) => <li className="overflow-hidden rounded-[var(--radius-control)] border border-border-subtle" key={component.id}>
          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-3 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden sm:px-4">
              <span className="min-w-0 break-words text-sm font-medium text-foreground">{component.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-right text-sm font-semibold tabular-nums text-foreground">{component.amountLabel}</span>
                <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-border-subtle bg-surface-subtle p-3 sm:p-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailValue label={t('payrollLabConceptSlipBasis')} value={component.basisLabel} />
                <DetailValue label={t('payrollLabConceptSlipMethod')} value={component.methodLabel} />
                <DetailValue label={t('payrollLabConceptSlipPercentage')} value={component.percentageLabel} />
                <DetailValue label={t('payrollLabConceptSlipHours')} value={component.hoursLabel} />
                <DetailValue label={t('payrollLabConceptSlipRounding')} value={component.roundingLabel} />
                {component.ruleRefs.length ? <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">{t('payrollLabConceptSlipRuleRefs')}</dt>
                  <dd className="mt-1"><ul className="space-y-1">{component.ruleRefs.map((ruleRef) => <li className="break-all font-mono text-xs text-foreground" key={ruleRef}>{ruleRef}</li>)}</ul></dd>
                </div> : null}
              </dl>
            </div>
          </details>
        </li>)}</ul>
        : <p className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 text-sm text-muted-foreground">{t('payrollLabConceptSlipNoGrossComponents')}</p>}

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t-2 border-border pt-4">
        <span className="text-base font-semibold text-foreground">{data.grossTotalLabel}</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{data.grossTotalAmountLabel}</span>
      </div>
      {data.roundingNote ? <p className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3 text-sm text-muted-foreground">{data.roundingNote}</p> : null}
    </section>

    <section aria-labelledby="payroll-not-calculated-heading" className="space-y-3 border-t border-border-subtle bg-surface-subtle p-4 sm:p-6">
      <h3 className="text-base font-semibold text-foreground" id="payroll-not-calculated-heading">{t('payrollLabConceptSlipNotCalculatedHeading')}</h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        <NotCalculated label={t('payrollLabConceptSlipDeductions')} t={t} />
        <NotCalculated label={t('payrollLabConceptSlipNet')} t={t} />
        <NotCalculated label={t('payrollLabConceptSlipEmployerCosts')} t={t} />
      </dl>
    </section>

    <details className="group border-t border-border-subtle">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden sm:px-6">
        <span className="text-sm font-semibold text-foreground">{t('payrollLabConceptSlipTechnicalDetails')}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-border-subtle p-4 sm:p-6">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetadataItem label={t('payrollLabConceptSlipRunId')} value={technical.runId} mono />
          <MetadataItem label={t('payrollLabConceptSlipSourceSnapshotId')} value={technical.sourceSnapshotId} mono />
          <MetadataItem label={t('payrollLabConceptSlipInputSetId')} value={technical.inputSetId} mono />
          <MetadataItem label={t('payrollLabConceptSlipPackageId')} value={technical.packageId} mono />
          <MetadataItem label={t('payrollLabConceptSlipEngineVersion')} value={technical.engineVersion} mono />
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{t('payrollLabConceptSlipRuleIds')}</dt>
            <dd className="mt-1">
              {technical.ruleIds.length
                ? <ul className="space-y-1">{technical.ruleIds.map((ruleId) => <li className="break-all font-mono text-xs text-foreground" key={ruleId}>{ruleId}</li>)}</ul>
                : <span className="text-sm text-muted-foreground">{t('payrollLabConceptSlipNoRuleIds')}</span>}
            </dd>
          </div>
        </dl>

        <section>
          <h3 className="text-sm font-semibold text-foreground">{t('payrollLabConceptSlipHashes')}</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetadataItem label={t('payrollLabConceptSlipSourceHash')} value={technical.hashes.source} mono />
            <MetadataItem label={t('payrollLabConceptSlipInputHash')} value={technical.hashes.input} mono />
            <MetadataItem label={t('payrollLabConceptSlipRunHash')} value={technical.hashes.run} mono />
          </dl>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <TechnicalList title={t('payrollLabConceptSlipTrace')} values={technical.trace} emptyLabel={t('payrollLabConceptSlipNoTrace')} />
          <TechnicalList title={t('payrollLabConceptSlipControls')} values={technical.controls} emptyLabel={t('payrollLabConceptSlipNoControls')} />
        </div>
      </div>
    </details>
  </Surface>
}
