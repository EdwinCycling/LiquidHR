import Link from 'next/link'
import { Calculator, Play } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { CaoBench02CalculationExperience } from '@/components/payroll/cao-bench02-calculation-experience'
import { PayrollLabControls } from '@/components/payroll/payroll-lab-controls'
import { PayrollLabRunContext } from '@/components/payroll/payroll-lab-run-context'
import { PageShell } from '@/components/layout/page-shell'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { PayrollLabUnavailableError, resolvePayrollLabAdministration } from '@/lib/payroll/access'
import { payrollScopeFromAuthContext } from '@/lib/payroll/scope'
import type { PayrollJson } from '@/lib/payroll/database'
import type { SyntheticPayrollView } from '@/lib/payroll/synthetic-calculation-service'
import {
  getLatestCaoBench02Payroll,
  isCaoBench02CalculationCase,
  type CaoBench02CaseKey,
} from '@/lib/payroll/cao-bench02-calculation-service'
import { GC_NL_001_PERIOD, getLatestSyntheticPayroll } from '@/lib/payroll/synthetic-calculation-service'
import { getLatestNl2026Payroll, NL_2026_TEST_SCENARIO } from '@/lib/payroll/nl-2026-calculation-service'
import { runNl2026PayrollAction, runSyntheticPayrollAction } from '../actions'
import { isPayrollLabErrorCode, payrollLabErrorMessageKey } from '../error-codes'
import { formatPayrollMoney } from '../format-money'
import { GC_NL_001_RULE_PACKAGE } from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_PACKAGE } from '@liquid-hr/payroll-rules-nl-2026'

const PAYROLL_AMOUNT_FIELDS = {
  nl2026: [
    { key: 'gross_salary', label: 'payrollLabAmountGrossSalary' },
    { key: 'taxable_wage', label: 'payrollLabAmountTaxableWage' },
    { key: 'wage_tax', label: 'payrollLabAmountWageTax' },
    { key: 'net_salary', label: 'payrollLabAmountNetSalary' },
  ],
  gcNl001: [
    { key: 'gross_salary', label: 'payrollLabAmountGrossSalary' },
    { key: 'employee_pension', label: 'payrollLabAmountEmployeePension' },
    { key: 'wage_tax', label: 'payrollLabAmountWageTax' },
    { key: 'net_salary', label: 'payrollLabAmountNetSalary' },
    { key: 'employer_pension', label: 'payrollLabAmountEmployerPension' },
    { key: 'employer_insurance', label: 'payrollLabAmountEmployerInsurance' },
    { key: 'employer_zvw', label: 'payrollLabAmountEmployerZvw' },
    { key: 'holiday_allowance_accrual', label: 'payrollLabAmountHolidayAllowanceAccrual' },
    { key: 'total_employer_cost', label: 'payrollLabAmountTotalEmployerCost' },
  ],
} as const

const PAYROLL_LAB_CASES = ['CC-NL-2026-001', 'GC-NL-001'] as const
type PayrollLabCase = (typeof PAYROLL_LAB_CASES)[number]

const PAYROLL_LAB_SCENARIOS: Readonly<Record<PayrollLabCase, { readonly period: SyntheticPayrollView['payrollPeriod']; readonly rulePackage: string }>> = Object.freeze({
  'CC-NL-2026-001': {
    period: NL_2026_TEST_SCENARIO.period,
    rulePackage: `${NL_2026_RULE_PACKAGE.metadata?.packageId ?? NL_2026_TEST_SCENARIO.compositionId} · ${NL_2026_RULE_PACKAGE.metadata?.version ?? '—'}`,
  },
  'GC-NL-001': {
    period: GC_NL_001_PERIOD,
    rulePackage: GC_NL_001_RULE_PACKAGE.compositionId,
  },
})

type ComponentCatalogLink = { readonly href: string; readonly ariaLabel: string }

type PayrollLabQuery = {
  run?: string | string[]
  error?: string | string[]
  case?: string | string[]
}

async function readLatestPayroll(load: () => Promise<SyntheticPayrollView | null>): Promise<{ value: SyntheticPayrollView | null; failed: boolean }> {
  try {
    return { value: await load(), failed: false }
  } catch {
    return { value: null, failed: true }
  }
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Amsterdam',
  }).format(date)
}

function statusTone(status: SyntheticPayrollView['status']): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'info'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

function MetadataItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-all text-sm text-foreground ${mono ? 'font-mono text-xs' : 'font-medium'}`.trim()}>{value}</dd>
    </div>
  )
}

function traceText(trace: SyntheticPayrollView['trace']): string | null {
  if (trace === null) return null
  try {
    return JSON.stringify(trace, null, 2)
  } catch {
    return null
  }
}

function traceRecord(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function componentCatalogLinks(latest: SyntheticPayrollView | null): ReadonlyMap<string, ComponentCatalogLink> {
  if (!latest || !traceRecord(latest.trace)) return new Map()
  const packageMetadata = traceRecord(latest.trace.packageMetadata) ? latest.trace.packageMetadata : null
  const packageId = typeof packageMetadata?.packageId === 'string' ? packageMetadata.packageId : ''
  const packageVersion = typeof packageMetadata?.version === 'string' ? packageMetadata.version : ''
  const links = new Map<string, ComponentCatalogLink>()

  for (const result of latest.components) {
    if (!traceRecord(result.payload) || !traceRecord(result.payload.component)) continue
    const component = result.payload.component
    const ownership = traceRecord(component.ownership) ? component.ownership : null
    const code = typeof component.code === 'string' ? component.code : ''
    const version = typeof component.version === 'string' ? component.version : ''
    if (ownership?.kind !== 'SYSTEM' || !code || !version) continue

    const catalogKey = [packageId, packageVersion, latest.rulePackageCompositionId, code, version]
      .map((part) => encodeURIComponent(part))
      .join('::')
    links.set(result.key, {
      href: `/payroll-components?component=${encodeURIComponent(catalogKey)}`,
      ariaLabel: `${code} · ${version}`,
    })
  }

  return links
}

function packageContextValue(
  latest: SyntheticPayrollView | null,
  scenario: PayrollLabCase,
  packageMetadata: { readonly [key: string]: PayrollJson | undefined } | null,
): string {
  if (!latest) return PAYROLL_LAB_SCENARIOS[scenario].rulePackage
  const packageId = typeof packageMetadata?.packageId === 'string' ? packageMetadata.packageId : null
  const version = typeof packageMetadata?.version === 'string' ? packageMetadata.version : null
  if (packageId && version) return `${packageId} · ${version}`
  return latest.rulePackageCompositionId
}

function CalculationTrace({ trace, t }: { trace: SyntheticPayrollView['trace']; t: Awaited<ReturnType<typeof getTranslator>> }) {
  const record = traceRecord(trace) ? trace : null
  const steps = record && Array.isArray(record.steps) ? record.steps : []
  const rules = steps.flatMap((step) => traceRecord(step) && Array.isArray(step.registeredRuleTrace) ? step.registeredRuleTrace : [])
  return <ol className="mt-4 space-y-4">{rules.map((rule, index) => {
    if (!traceRecord(rule)) return null
    const values = traceRecord(rule.values) ? rule.values : {}
    const code = typeof rule.code === 'string' ? rule.code : ''
    return <li className="border-t border-subtle pt-3" key={`${code}-${index}`}>
      <p className="text-sm font-medium">{t(`payrollLabTrace_${code.replaceAll('.', '_').replaceAll('-', '_')}`)}</p>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(values).map(([key, value]) => <div className="min-w-0" key={key}><dt className="break-all text-muted-foreground">{key}</dt><dd className="break-all font-mono">{String(traceRecord(value) && 'value' in value ? value.value ?? '—' : value ?? '—')}</dd></div>)}</dl>
      <p className="mt-2 break-words text-xs text-muted-foreground">{typeof rule.sourceReference === 'string' ? rule.sourceReference : ''}</p>
    </li>
  })}</ol>
}

function formatPeriod(period: SyntheticPayrollView['payrollPeriod']): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

function formatPeriodHeading(period: SyntheticPayrollView['payrollPeriod'], locale: string): string {
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(period.year, period.month - 1, 1)))
  return `${month.charAt(0).toLocaleUpperCase(locale)}${month.slice(1)} ${period.year}`
}

function validRunId(value: string | string[] | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function payrollLabCase(value: string | string[] | undefined): PayrollLabCase | null {
  return typeof value === 'string' && PAYROLL_LAB_CASES.includes(value as PayrollLabCase) ? value as PayrollLabCase : null
}

function caoBench02Case(value: string | string[] | undefined): CaoBench02CaseKey | null {
  if (typeof value !== 'string') return null
  if (value === 'CAO-BENCH02-H1' || isCaoBench02CalculationCase(value)) return value
  return null
}

function AmountList({
  fields,
  amounts,
  componentLinks,
  viewComponentLabel,
  locale,
  featured = false,
}: {
  fields: readonly { key: string; label: string }[]
  amounts: ReadonlyMap<string, string | null>
  componentLinks: ReadonlyMap<string, ComponentCatalogLink>
  viewComponentLabel: string
  locale: string
  featured?: boolean
}) {
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${featured ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
      {fields.map(({ key, label }) => {
        const amount = amounts.get(key) ?? null
        const componentLink = componentLinks.get(key)
        return (
          <div className="min-w-0" data-component-key={key} key={key}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="min-w-0" data-amount={amount ?? ''}>
              <span className={`${featured ? 'mt-1 block text-2xl sm:text-3xl' : 'mt-1 block text-lg'} break-all font-semibold tabular-nums text-foreground`}>
                {formatPayrollMoney(amount, locale)}
              </span>
              {componentLink ? <Link className="mt-1 inline-flex max-w-full flex-wrap gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" href={componentLink.href} aria-label={`${viewComponentLabel}: ${componentLink.ariaLabel}`}>{viewComponentLabel}<code className="break-all">{componentLink.ariaLabel}</code></Link> : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

export default async function PayrollLabPage({
  searchParams,
}: {
  searchParams?: Promise<PayrollLabQuery>
}) {
  let context
  try {
    context = await requirePermission('salary:read')
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    redirect('/geen-toegang')
  }

  let administration
  try {
    administration = await resolvePayrollLabAdministration(context)
  } catch (error) {
    if (!(error instanceof PayrollLabUnavailableError)) {
      const t = await getTranslator('navigation')
      return (
        <PageShell className="space-y-6 py-6 sm:py-8" width="standard" role="status">
          <Link href="/payroll-lab" className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabBackToOverview')}</Link>
          <PageHeader title={t('payrollLab')} description={t('payrollLabRunUnavailable')} />
        </PageShell>
      )
    }
    const t = await getTranslator('navigation')
    return (
      <PageShell className="space-y-6 py-6 sm:py-8" width="standard" role="status">
        <Link href="/payroll-lab" className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabBackToOverview')}</Link>
          <PageHeader title={t('payrollLab')} description={t('payrollLabUnavailable')} />
      </PageShell>
    )
  }
  if (!administration) redirect('/geen-toegang')

  const scope = payrollScopeFromAuthContext(context)
  if (!scope) redirect('/geen-toegang')

  const [t, locale, query] = await Promise.all([
    getTranslator('navigation'),
    getLocale(),
    searchParams ?? Promise.resolve<PayrollLabQuery>({}),
  ])
  const canRun = context.permissions.includes('salary:write')
  const requestedBenchCase = caoBench02Case(query.case)
  if (requestedBenchCase) {
    const isApplicabilityOnly = requestedBenchCase === 'CAO-BENCH02-H1'
    const requestedBenchRun = validRunId(query.run) ? query.run : undefined
    let benchLatest: SyntheticPayrollView | null = null
    let benchLoadFailed = false
    let benchRunUnavailable = query.run !== undefined && requestedBenchRun === undefined
    if (!isApplicabilityOnly && !benchRunUnavailable) {
      const benchRead = await readLatestPayroll(() => getLatestCaoBench02Payroll(scope, administration.id, requestedBenchCase, requestedBenchRun))
      benchLatest = benchRead.value
      benchLoadFailed = benchRead.failed
      if (requestedBenchRun && benchLatest?.runId !== requestedBenchRun) {
        benchRunUnavailable = !benchLoadFailed
        benchLatest = null
      }
    }
    const queryError = typeof query.error === 'string' ? query.error : null
    const failureCode = isPayrollLabErrorCode(queryError)
      ? queryError
      : benchLatest?.status === 'FAILED'
        ? benchLatest.errorCode
        : null
    const benchErrorMessage = benchLoadFailed
      ? t('payrollLabRunUnavailable')
      : benchRunUnavailable
        ? t('payrollLabRequestedRunUnavailable')
        : queryError === 'unavailable'
          ? t('payrollLabRunUnavailable')
          : failureCode
            ? t(payrollLabErrorMessageKey(failureCode))
            : null
    return (
      <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
        <CaoBench02CalculationExperience
          administrationName={administration.displayName}
          canRun={canRun}
          caseKey={requestedBenchCase}
          errorMessage={benchErrorMessage}
          latest={benchLatest}
          locale={locale}
          t={t}
        />
      </PageShell>
    )
  }
  const requestedCase = payrollLabCase(query.case)
  const requestedRunId = validRunId(query.run) ? query.run : null
  const hasRequestedRun = requestedRunId !== null
  const shouldReadSynthetic = requestedCase === 'GC-NL-001' || (!requestedCase && hasRequestedRun)
  const shouldReadNl2026 = requestedCase !== 'GC-NL-001'
  const [nlRead, syntheticRead] = await Promise.all([
    shouldReadNl2026
      ? readLatestPayroll(() => getLatestNl2026Payroll(scope, administration.id, requestedRunId ?? undefined))
      : Promise.resolve({ value: null, failed: false }),
    shouldReadSynthetic
      ? readLatestPayroll(() => getLatestSyntheticPayroll(scope, administration.id, requestedRunId ?? undefined))
      : Promise.resolve({ value: null, failed: false }),
  ])
  let selectedCase: PayrollLabCase = requestedCase ?? 'CC-NL-2026-001'
  let latest: SyntheticPayrollView | null = null
  let loadFailed = false
  let requestedRunUnavailable = false

  if (hasRequestedRun) {
    if (requestedCase === 'GC-NL-001') {
      selectedCase = 'GC-NL-001'
      latest = syntheticRead.value?.runId === requestedRunId ? syntheticRead.value : null
      loadFailed = syntheticRead.failed
    } else if (requestedCase === 'CC-NL-2026-001') {
      selectedCase = 'CC-NL-2026-001'
      latest = nlRead.value?.runId === requestedRunId ? nlRead.value : null
      loadFailed = nlRead.failed
    } else if (nlRead.value?.runId === requestedRunId) {
      selectedCase = 'CC-NL-2026-001'
      latest = nlRead.value
    } else if (syntheticRead.value?.runId === requestedRunId) {
      selectedCase = 'GC-NL-001'
      latest = syntheticRead.value
    } else {
      loadFailed = nlRead.failed || syntheticRead.failed
    }
    requestedRunUnavailable = !latest && !loadFailed
  } else if (requestedCase === 'GC-NL-001') {
    selectedCase = 'GC-NL-001'
    latest = syntheticRead.value
    loadFailed = syntheticRead.failed
  } else {
    selectedCase = 'CC-NL-2026-001'
    latest = nlRead.value
    loadFailed = nlRead.failed
  }

  const queryError = typeof query.error === 'string' ? query.error : null
  const queryFailureCode = isPayrollLabErrorCode(queryError) ? queryError : null
  const failedLatestRun = latest?.status === 'FAILED'
    && (!validRunId(query.run) || latest.runId === query.run)
    ? latest
    : null
  const failureCode = queryFailureCode ?? (failedLatestRun?.errorCode ?? (failedLatestRun ? 'PAYROLL_CALCULATION_FAILED' : null))
  const errorMessage = queryError === 'unavailable' || loadFailed
    ? t('payrollLabRunUnavailable')
    : requestedRunUnavailable
      ? t('payrollLabRequestedRunUnavailable')
    : failureCode
      ? t(payrollLabErrorMessageKey(failureCode))
      : null
  const runReference = validRunId(query.run)
    ? requestedRunId
    : failedLatestRun && validRunId(failedLatestRun.runId)
      ? failedLatestRun.runId
      : null
  const runCompleted = Boolean(latest && validRunId(query.run) && latest.runId === query.run && latest.status === 'SUCCEEDED')
  const renderedTrace = latest ? traceText(latest.trace) : null
  const amounts = new Map<string, string | null>(latest?.components.map((component) => [component.key, component.amount]) ?? [])
  const packageMetadata = latest && traceRecord(latest.trace) && traceRecord(latest.trace.packageMetadata) ? latest.trace.packageMetadata : null
  const sourceMetadata = packageMetadata && traceRecord(packageMetadata.sourceMetadata) ? packageMetadata.sourceMetadata : null
  const selectedScenario = PAYROLL_LAB_SCENARIOS[selectedCase]
  const periodHeading = formatPeriodHeading(latest?.payrollPeriod ?? selectedScenario.period, locale)
  const showingSyntheticGc = selectedCase === 'GC-NL-001'
  const summaryFields = showingSyntheticGc ? PAYROLL_AMOUNT_FIELDS.gcNl001 : PAYROLL_AMOUNT_FIELDS.nl2026
  const contextCase = latest?.caseKey ?? selectedCase
  const contextScenario = contextCase === 'GC-NL-001'
    ? `${contextCase} · ${t('payrollLabViewGcNl001')}`
    : `${contextCase} · ${t('payrollLabViewNl2026')}`
  const componentLinks = componentCatalogLinks(latest)

  return (
    <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
      <Link href="/payroll-lab" className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabBackToOverview')}</Link>
      <PageHeader
        description={t(showingSyntheticGc ? 'payrollLabGcNl001Description' : 'payrollLabNl2026Description')}
        title={t('payrollLabCalculations')}
      />
      <nav aria-label={t('payrollLabCaseSelector')} className="flex flex-wrap gap-2">
        <Link aria-current={!showingSyntheticGc ? 'page' : undefined} className={buttonClasses({ size: 'sm', variant: showingSyntheticGc ? 'secondary' : 'primary' })} href="/payroll-lab/calculations?case=CC-NL-2026-001">{t('payrollLabViewNl2026')}</Link>
        <Link aria-current={showingSyntheticGc ? 'page' : undefined} className={buttonClasses({ size: 'sm', variant: showingSyntheticGc ? 'primary' : 'secondary' })} href="/payroll-lab/calculations?case=GC-NL-001">{t('payrollLabViewGcNl001')}</Link>
        <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/payroll-lab/calculations?case=CAO-BENCH02-K1">{t('payrollLabBenchTitle')}</Link>
      </nav>

      <Surface className="p-4 sm:p-6">
        <SectionHeader
          description={t('payrollLabTrialRunDescription')}
          title={t('payrollLabTrialRunTitle')}
        />
        <p className="mt-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">{t('payrollLabActiveAdministration')}:</span> {administration.displayName}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { caseKey: 'CC-NL-2026-001' as const, title: t('payrollLabViewNl2026'), description: t('payrollLabNl2026Description'), action: runNl2026PayrollAction },
            { caseKey: 'GC-NL-001' as const, title: t('payrollLabViewGcNl001'), description: t('payrollLabGcNl001Description'), action: runSyntheticPayrollAction },
          ].map((scenario) => (
            <article className="min-w-0 rounded-[var(--radius-surface)] border border-border-subtle p-4" key={scenario.caseKey}>
              <h3 className="text-sm font-semibold text-foreground">{scenario.title} <span className="font-mono text-xs font-normal text-muted-foreground">· {scenario.caseKey}</span></h3>
              <p className="mt-2 text-sm text-muted-foreground">{scenario.description}</p>
              <dl className="mt-4 grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
                <MetadataItem label={t('payrollLabPeriod')} value={formatPeriodHeading(PAYROLL_LAB_SCENARIOS[scenario.caseKey].period, locale)} />
                <MetadataItem label={t('payrollLabRulePackageContext')} value={PAYROLL_LAB_SCENARIOS[scenario.caseKey].rulePackage} />
              </dl>
              {canRun ? <form action={scenario.action} className="mt-4"><Button type="submit"><Play aria-hidden="true" />{t('payrollLabStartTrialRun')}</Button></form> : <p className="mt-4 text-xs text-muted-foreground">{t('payrollLabRunRequiresWrite')}</p>}
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t('payrollLabOtherSupportedScenarios')} <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/payroll-lab/calculations?case=CAO-BENCH02-K1">{t('payrollLabBenchTitle')}</Link></p>
      </Surface>

      {errorMessage ? (
        <Surface className="border-destructive/40 p-4 text-sm text-destructive" role="alert">
          <p>{errorMessage}</p>
          {failedLatestRun?.unsupportedReason || failureCode || runReference ? <details className="mt-3 rounded-[var(--radius-control)] border border-destructive/30 p-3">
            <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabTechnicalDetails')}</summary>
            {failedLatestRun?.unsupportedReason ? <p className="mt-2 break-all">{failedLatestRun.unsupportedReason}</p> : null}
            {failureCode ? <p className="mt-2"><span className="font-medium">{t('payrollLabErrorCode')}:</span> <code>{failureCode}</code></p> : null}
            {runReference ? <p className="mt-1"><span className="font-medium">{t('payrollLabRunReference')}:</span> <code>{runReference}</code></p> : null}
          </details> : null}
        </Surface>
      ) : null}
      {runCompleted ? <Surface className="border-success/50 p-4 text-sm text-success" role="status">{t('payrollLabRunCompleted')}</Surface> : null}

      {latest ? <PayrollLabRunContext
        administration={administration.displayName}
        administrationLabel={t('payrollLabActiveAdministration')}
        contextLabel={t('payrollLabRunContext')}
        period={periodHeading}
        periodLabel={t('payrollLabPeriod')}
        rulePackage={packageContextValue(latest, selectedCase, packageMetadata)}
        rulePackageLabel={t('payrollLabRulePackageContext')}
        scenario={contextScenario}
        scenarioLabel={t('payrollLabCase')}
      /> : null}

      {!latest ? (
        <EmptyState
          description={loadFailed ? t('payrollLabRunUnavailable') : requestedRunUnavailable ? t('payrollLabRequestedRunUnavailable') : t('payrollLabEmptyDescription')}
          icon={<Calculator />}
          title={loadFailed ? t('payrollLabRunUnavailable') : requestedRunUnavailable ? t('payrollLabRunUnavailable') : t('payrollLabEmptyTitle')}
        />
      ) : (
        <>
          <Surface className="p-4 sm:p-6">
            <SectionHeader
              actions={<Badge tone={statusTone(latest.status)}>{latest.status}</Badge>}
              title={t('payrollLabTestEmployee')}
            />
            <div className="mt-6">
              <AmountList
                fields={summaryFields.map(({ key, label }) => ({ key, label: t(label) }))}
                amounts={amounts}
                componentLinks={componentLinks}
                viewComponentLabel={t('payrollLabViewComponentVersion')}
                locale={locale}
                featured
              />
            </div>
          </Surface>

          <Surface className="p-4 sm:p-6">
            <SectionHeader title={t('payrollLabRunStatus')} />
            <details className="mt-4 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabTechnicalDetails')}</summary>
              <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetadataItem label={t('payrollLabPeriod')} value={formatPeriod(latest.payrollPeriod)} />
                <MetadataItem label={t('payrollLabCase')} value={latest.caseKey ?? selectedCase} />
                <MetadataItem label={t('payrollLabRunType')} value={latest.runType} />
                <MetadataItem label={t('payrollLabRunId')} value={latest.runId} mono />
                <MetadataItem label={t('payrollLabEmployee')} value={latest.employeeId} mono />
                <MetadataItem label={t('payrollLabRuleComposition')} value={latest.rulePackageCompositionId} mono />
                <MetadataItem label={t('payrollLabEngineVersion')} value={latest.engineVersion} mono />
                <MetadataItem label={t('payrollLabPackageVersion')} value={String(packageMetadata?.version ?? '—')} />
                <MetadataItem label={t('payrollLabPackageHash')} value={String(packageMetadata?.packageHash ?? '—')} mono />
                <MetadataItem label={t('payrollLabStatutorySource')} value={String(sourceMetadata?.calculationRulesTitle ?? '—')} />
                <MetadataItem label={t('payrollLabSourceHash')} value={latest.sourceHash} mono />
                <MetadataItem label={t('payrollLabInputHash')} value={latest.inputHash} mono />
                <MetadataItem label={t('payrollLabResultHash')} value={latest.resultHash ?? '—'} mono />
                <MetadataItem label={t('payrollLabCreatedAt')} value={formatDateTime(latest.createdAt, locale)} />
                <MetadataItem label={t('payrollLabStartedAt')} value={formatDateTime(latest.startedAt, locale)} />
                <MetadataItem label={t('payrollLabFinishedAt')} value={formatDateTime(latest.finishedAt, locale)} />
              </dl>
              {renderedTrace ? <details className="mt-4 rounded-[var(--radius-control)] border border-border-subtle p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-focus">{t('payrollLabDebugTrace')}</summary>
                <pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{renderedTrace}</pre>
              </details> : null}
            </details>
          </Surface>

          <div className="grid gap-4 lg:grid-cols-2">
            <PayrollLabControls controls={latest.controls} t={t} />

            <Surface className="min-w-0 p-4 sm:p-6">
              <SectionHeader title={t('payrollLabTrace')} />
              {renderedTrace ? (
                <details className="mt-4 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">{t('payrollLabTrace')}</summary>
                  <CalculationTrace trace={latest.trace} t={t} />
                </details>
              ) : <p className="mt-4 text-sm text-muted-foreground">{t('payrollLabNoTrace')}</p>}
            </Surface>
          </div>
        </>
      )}
    </PageShell>
  )
}
