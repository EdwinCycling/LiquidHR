'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import {
  openLocalPayrollAcceptancePeriod,
  runLocalPayrollAcceptanceDemo003,
  runLocalPayrollAcceptance,
  runLocalPayrollAcceptanceVariableRevision,
  type LocalPayrollAcceptanceOpenState,
  type LocalPayrollAcceptanceRunState,
} from './actions'

type WorkbenchProps = {
  readonly periodStatus: string | null
  readonly periodStatusLabel: string
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}

const initialOpenState: LocalPayrollAcceptanceOpenState = { message: 'idle' }
const initialRunState: LocalPayrollAcceptanceRunState = { message: 'idle', result: null, failureCode: null, sourceChecks: null }

const missingComponentLabels: Readonly<Record<string, string>> = {
  PENSION_EMPLOYEE_ALLOCATION: 'localAcceptanceMissingEmployeePension',
  PENSION_EMPLOYER_ALLOCATION: 'localAcceptanceMissingEmployerPension',
  EMPLOYER_SOCIAL_COSTS: 'localAcceptanceMissingEmployerCosts',
  HOLIDAY_AND_YEAR_END_RESERVES: 'localAcceptanceMissingReserves',
  CUMULATIVE_WAGE_TAX: 'localAcceptanceMissingCumulativeTax',
  VARIABLE_AND_NON_REGULAR_WAGE: 'localAcceptanceMissingVariableWage',
}

const sourceGapLabels: Readonly<Record<string, string>> = {
  contractualSalary: 'missingSalary',
  contractualHours: 'missingSchedule',
  contract: 'missingContract',
  laborCondition: 'missingLaborConditions',
  incomeRelationship: 'missingIncomeRelationship',
  taxProfile: 'missingTaxProfile',
}

function gapLabel(field: string, reasonCode: string, labels: Readonly<Record<string, string>>): string {
  if (reasonCode === 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR') return labels.localAcceptanceSalaryMismatch
  const key = sourceGapLabels[field]
  return key ? labels[key] : labels.localAcceptanceUnknownGap
}

function formatMoney(value: string | null, locale: string, missing: string): string {
  if (value === null || !/^-?\d{1,12}(?:\.\d{1,2})?$/.test(value)) return missing
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value))
}

function HashValue({ label, value }: { readonly label: string; readonly value: string | null }) {
  return <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-all font-mono text-xs text-foreground">{value ?? '—'}</dd>
  </div>
}

export function LocalPayrollAcceptanceWorkbench({ periodStatus, periodStatusLabel, locale, labels }: WorkbenchProps) {
  const [openState, openAction, opening] = useActionState(openLocalPayrollAcceptancePeriod, initialOpenState)
  const [runState, runAction, running] = useActionState(runLocalPayrollAcceptance, initialRunState)
  const [demo003State, demo003Action, demo003Running] = useActionState(runLocalPayrollAcceptanceDemo003, initialRunState)
  const [variableState, variableAction, variableRunning] = useActionState(runLocalPayrollAcceptanceVariableRevision, initialRunState)
  const calculations = [
    ...(runState.result?.calculations ?? []),
    ...(demo003State.result?.calculations ?? []),
    ...(variableState.result?.calculations ?? []),
  ]
  const preflights = [
    ...(runState.result?.preflight ?? []),
    ...(demo003State.result?.preflight ?? []),
    ...(variableState.result?.preflight ?? []),
  ]
  const periodOpen = periodStatus === 'OPEN' || openState.message === 'opened'
  const statusMessage = openState.message === 'opened'
    ? labels.localAcceptancePeriodOpened
    : openState.message === 'accessDenied'
      ? labels.localAcceptanceAccessDenied
      : openState.message === 'unavailable'
        ? labels.localAcceptanceUnavailable
        : openState.message === 'failed'
          ? labels.localAcceptanceOpenFailed
          : runState.message === 'preflightBlocked'
            ? labels.localAcceptancePreflightBlocked
            : runState.message === 'saved'
              ? labels.localAcceptanceSaved
              : runState.message === 'partial'
                ? labels.localAcceptancePartial
                : runState.message === 'accessDenied'
                  ? labels.localAcceptanceAccessDenied
                  : runState.message === 'unavailable'
                    ? labels.localAcceptanceUnavailable
                    : runState.message === 'failed'
                      ? labels.localAcceptanceFailed
                      : null

  return <div className="space-y-5">
    <Surface className="space-y-4 border-info-border bg-info-surface p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{labels.localAcceptanceRestricted}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{labels.localAcceptanceAssumptionsDetail}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceScope}</dt>
          <dd className="mt-1 text-sm font-medium">Mars BV</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptancePeriod}</dt>
          <dd className="mt-1 text-sm font-medium">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 1)))}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceAssumptions}</dt>
          <dd className="mt-1 text-sm">{labels.localAcceptanceAssumptionsSummary}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceStatus}</dt>
          <dd className="mt-1 text-sm">{periodOpen ? labels.localAcceptancePeriodOpen : periodStatusLabel}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={openAction}>
          <Button type="submit" variant="secondary" loading={opening} disabled={opening || periodStatus === 'CLOSED' || periodOpen}>
            {opening ? labels.localAcceptanceOpeningPeriod : periodOpen ? labels.localAcceptancePeriodAlreadyOpen : labels.localAcceptanceOpenPeriod}
          </Button>
        </form>
        <form action={runAction}>
          <Button type="submit" loading={running} disabled={running || !periodOpen}>
            {running ? labels.localAcceptanceRunning : labels.localAcceptanceRun}
          </Button>
        </form>
        <form action={demo003Action}>
          <Button type="submit" variant="secondary" loading={demo003Running} disabled={demo003Running || !periodOpen}>
            {demo003Running ? labels.localAcceptanceDemo003Running : labels.localAcceptanceDemo003Run}
          </Button>
        </form>
        <form action={variableAction}>
          <Button type="submit" variant="secondary" loading={variableRunning} disabled={variableRunning || !periodOpen}>
            {variableRunning ? labels.localAcceptanceVariableRevisionRunning : labels.localAcceptanceVariableRevisionRun}
          </Button>
        </form>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{labels.localAcceptanceVariableRevisionHelp}</p>
      {statusMessage ? <p className="text-sm" role="status" aria-live="polite">{statusMessage}{runState.failureCode ? <code className="ml-2 font-mono text-xs">{runState.failureCode}</code> : null}{runState.sourceChecks?.length ? <code className="ml-2 font-mono text-xs">source checks: {runState.sourceChecks.join(', ')}</code> : null}</p> : null}
      {variableState.message !== 'idle' ? <p className="text-sm" role="status" aria-live="polite">
        {variableState.message === 'saved' ? labels.localAcceptanceVariableRevisionSaved
          : variableState.message === 'partial' ? labels.localAcceptancePartial
            : variableState.message === 'preflightBlocked' ? labels.localAcceptancePreflightBlocked
              : variableState.message === 'accessDenied' ? labels.localAcceptanceAccessDenied
                : variableState.message === 'unavailable' ? labels.localAcceptanceUnavailable
                  : labels.localAcceptanceFailed}
        {variableState.failureCode ? <code className="ml-2 font-mono text-xs">{variableState.failureCode}</code> : null}
      </p> : null}
      {demo003State.message !== 'idle' ? <p className="text-sm" role="status" aria-live="polite">
        {demo003State.message === 'saved' ? labels.localAcceptanceDemo003Saved
          : demo003State.message === 'partial' ? labels.localAcceptancePartial
            : demo003State.message === 'preflightBlocked' ? labels.localAcceptancePreflightBlocked
              : demo003State.message === 'accessDenied' ? labels.localAcceptanceAccessDenied
                : demo003State.message === 'unavailable' ? labels.localAcceptanceUnavailable
                  : labels.localAcceptanceFailed}
        {demo003State.failureCode ? <code className="ml-2 font-mono text-xs">{demo003State.failureCode}</code> : null}
        {demo003State.sourceChecks?.length ? <code className="ml-2 font-mono text-xs">source checks: {demo003State.sourceChecks.join(', ')}</code> : null}
      </p> : null}
    </Surface>

    {runState.result || demo003State.result || variableState.result ? <>
      {preflights.length > 0 ? <section className="space-y-3" aria-labelledby="local-acceptance-preflight">
        <h2 className="text-base font-semibold" id="local-acceptance-preflight">{labels.localAcceptancePreflight}</h2>
        <ul className="divide-y divide-border-subtle rounded-[var(--radius-surface)] border border-border-subtle">
          {preflights.map((item) => <li key={item.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{labels.localAcceptanceCandidate} {item.key}</p>
              {item.gaps.length > 0 ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {item.gaps.map((gap, index) => <li key={`${gap.field}-${gap.reasonCode}-${index}`} className="break-words">{gapLabel(gap.field, gap.reasonCode, labels)}</li>)}
              </ul> : null}
            </div>
            <span className="text-sm text-muted-foreground">{item.expectedException
              ? labels.localAcceptanceBlockedReadOnly
              : item.eligibleForCalculation ? labels.localAcceptanceEligible : labels.localAcceptanceGaps}</span>
          </li>)}
        </ul>
      </section> : null}

      {calculations.length > 0 ? <section className="space-y-3" aria-labelledby="local-acceptance-results">
        <h2 className="text-base font-semibold" id="local-acceptance-results">{labels.localAcceptanceResults}</h2>
        <p className="text-sm text-muted-foreground">{labels.localAcceptanceTestNature}</p>
        <div className="space-y-4">
          {calculations.map((item) => <Surface key={item.key} className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">{labels.localAcceptanceCandidate} {item.key}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.businessStatus === 'CONCEPT'
                  ? labels.localAcceptanceConcept
                  : item.businessStatus === 'REVIEWED' ? labels.localAcceptanceReviewed
                    : item.businessStatus === 'FINALIZED' ? labels.localAcceptanceFinalized
                      : item.status === 'CORRECTION_REQUIRED' ? labels.localAcceptanceCorrectionRequired
                        : item.status === 'FAILED' ? labels.calculation_FAILED : labels.localAcceptanceFailed}</p>
                {item.errorCode ? <code className="mt-1 block break-words text-xs text-muted-foreground">{item.errorCode}</code> : null}
              </div>
              <p className="text-sm font-medium">{item.completeness === 'COMPLETE' ? labels.localAcceptanceComplete : labels.localAcceptanceIncomplete}</p>
            </div>
            {item.runId ? <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/payroll/runs/${encodeURIComponent(item.runId)}`}>
              {labels.localAcceptanceOpenRun}
            </Link> : null}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceGross}</dt><dd className="mt-1 text-sm font-semibold">{formatMoney(item.grossAmount, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceTaxableWage}</dt><dd className="mt-1 text-sm font-semibold">{formatMoney(item.payfull02?.taxableWage ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceWageTax}</dt><dd className="mt-1 text-sm font-semibold">{formatMoney(item.wageTaxAmount, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployeePension}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employeePension ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceNetReimbursement}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.netReimbursement ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceNetDeduction}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.netDeduction ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceNetPay}</dt><dd className="mt-1 text-sm font-bold">{formatMoney(item.remainingAfterWageTax, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerPension}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerPension ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerAwf}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerAwf ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerAof}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerAof ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerWko}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerWko ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerWhk}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerWhk ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerZvw}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerZvw ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceEmployerPremiums}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.employerPremiums ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceHolidayReserve}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.holidayReserve ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceYearEndReserve}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02?.yearEndReserve ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceTotalEmployerCost}</dt><dd className="mt-1 text-sm font-bold">{formatMoney(item.payfull02?.totalEmployerCost ?? null, locale, labels.localAcceptanceMissing)}</dd></div>
            </dl>
            {item.payfull02 ? <div className="space-y-2 border-t border-border-subtle pt-4">
              <h4 className="text-sm font-semibold">{labels.localAcceptanceCumulative}</h4>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeGross}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeGross, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeTaxableWage}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeTaxableWage, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeWageTax}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeWageTax, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeEmployeeInsurance}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeEmployeeInsuranceWage, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeZvw}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeZvwWage, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeHolidayReserve}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeHolidayReserve, locale, labels.localAcceptanceMissing)}</dd></div>
                <div><dt className="text-xs font-medium text-muted-foreground">{labels.localAcceptanceCumulativeYearEndReserve}</dt><dd className="mt-1 text-sm">{formatMoney(item.payfull02.cumulativeYearEndReserve, locale, labels.localAcceptanceMissing)}</dd></div>
              </dl>
            </div> : null}
            <p className="text-sm"><span className="font-medium">{labels.localAcceptanceIdempotent}:</span> {item.idempotencyVerified ? labels.localAcceptanceIdempotentYes : labels.localAcceptanceIdempotentNo}</p>
            <p className={`text-sm ${item.oracleMatches ? 'text-muted-foreground' : 'text-warning'}`}>{item.oracleMatches ? labels.localAcceptanceOracleMatches : labels.localAcceptanceOracleMismatch}</p>
            {item.incompleteComponents.length > 0 ? <div>
              <h4 className="text-sm font-semibold">{labels.localAcceptanceMissing}</h4>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {item.incompleteComponents.map((component) => <li key={component}>{labels[missingComponentLabels[component] ?? 'localAcceptanceMissing']}</li>)}
              </ul>
            </div> : null}
            <div className="space-y-3 border-t border-border-subtle pt-4">
              <h4 className="text-sm font-semibold">{labels.localAcceptanceProvenance}</h4>
              <dl className="grid gap-3 sm:grid-cols-2">
                <HashValue label={labels.localAcceptanceRunId} value={item.runId} />
                <HashValue label={labels.localAcceptanceSourceSnapshotId} value={item.sourceSnapshotId} />
                <HashValue label={labels.localAcceptanceInputSetId} value={item.inputSetId} />
                <HashValue label={labels.localAcceptanceInputReferenceId} value={item.readback?.inputReferenceId ?? null} />
                <HashValue label={labels.localAcceptanceTraceId} value={item.readback?.traceId ?? null} />
                <HashValue label={labels.localAcceptanceConceptEventId} value={item.readback?.conceptEventId ?? null} />
                <HashValue label={labels.localAcceptanceSourceHash} value={item.sourceHash} />
                <HashValue label={labels.localAcceptanceCoreSourceHash} value={item.readback?.coreSourceHash ?? null} />
                <HashValue label={labels.localAcceptanceAssumptionsHash} value={item.readback?.assumptionsHash ?? null} />
                <HashValue label={labels.localAcceptancePayrollSetupHash} value={item.readback?.payrollSetupHash ?? null} />
                <HashValue label={labels.localAcceptanceOpeningBalanceHash} value={item.readback?.openingBalanceSourceHash ?? null} />
                <HashValue label={labels.localAcceptanceInputHash} value={item.inputHash} />
                <HashValue label={labels.localAcceptanceResultHash} value={item.resultHash} />
              </dl>
              {item.readback ? <>
                <p className="text-xs text-muted-foreground">{labels.localAcceptanceComponentCount}: {item.readback.componentResultCount} · {labels.localAcceptanceControlCount}: {item.readback.controlCount}</p>
                <div>
                  <h5 className="text-sm font-medium">{labels.localAcceptanceControls}</h5>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {item.readback.controls.map((control, index) => <li key={`${control.key}-${index}`} className="break-words">{control.key} · {labels[`control_${control.status}`] ?? labels.localAcceptanceUnknownGap}</li>)}
                  </ul>
                </div>
              </> : null}
            </div>
          </Surface>)}
        </div>
      </section> : null}
    </> : null}
  </div>
}
