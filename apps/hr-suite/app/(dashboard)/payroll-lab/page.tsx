import { Calculator, Play } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { PageShell } from '@/components/layout/page-shell'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { PayrollLabUnavailableError, resolvePayrollLabAdministration } from '@/lib/payroll/access'
import { payrollScopeFromAuthContext } from '@/lib/payroll/scope'
import { getLatestSyntheticPayroll, type SyntheticPayrollView } from '@/lib/payroll/synthetic-calculation-service'
import { runSyntheticPayrollAction } from './actions'
import { isPayrollLabErrorCode, payrollLabErrorMessageKey } from './error-codes'
import { formatPayrollMoney } from './format-money'

const PAYROLL_AMOUNT_FIELDS = {
  summary: [
    { key: 'gross_salary', label: 'payrollLabAmountGrossSalary' },
    { key: 'net_salary', label: 'payrollLabAmountNetSalary' },
    { key: 'total_employer_cost', label: 'payrollLabAmountTotalEmployerCost' },
  ],
  deductions: [
    { key: 'employee_pension', label: 'payrollLabAmountEmployeePension' },
    { key: 'wage_tax', label: 'payrollLabAmountWageTax' },
  ],
  employer: [
    { key: 'employer_pension', label: 'payrollLabAmountEmployerPension' },
    { key: 'employer_insurance', label: 'payrollLabAmountEmployerInsurance' },
    { key: 'employer_zvw', label: 'payrollLabAmountEmployerZvw' },
    { key: 'holiday_allowance_accrual', label: 'payrollLabAmountHolidayAllowanceAccrual' },
  ],
} as const

type PayrollLabQuery = {
  run?: string | string[]
  error?: string | string[]
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

function controlTone(status: SyntheticPayrollView['controls'][number]['status']): 'success' | 'warning' | 'danger' {
  if (status === 'PASS') return 'success'
  if (status === 'FAIL') return 'danger'
  return 'warning'
}

function controlStatusLabel(status: SyntheticPayrollView['controls'][number]['status'], t: Awaited<ReturnType<typeof getTranslator>>): string {
  if (status === 'PASS') return t('payrollLabControlPassed')
  if (status === 'FAIL') return t('payrollLabControlFailed')
  return t('payrollLabControlWarning')
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

function AmountList({
  fields,
  amounts,
  locale,
  featured = false,
}: {
  fields: readonly { key: string; label: string }[]
  amounts: ReadonlyMap<string, string | null>
  locale: string
  featured?: boolean
}) {
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${featured ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
      {fields.map(({ key, label }) => {
        const amount = amounts.get(key) ?? null
        return (
          <div className="min-w-0" data-component-key={key} key={key}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={`${featured ? 'mt-1 text-2xl sm:text-3xl' : 'mt-1 text-lg'} break-all font-semibold tabular-nums text-foreground`} data-amount={amount ?? ''}>
              {formatPayrollMoney(amount, locale)}
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
          <PageHeader title={t('payrollLab')} description={t('payrollLabRunUnavailable')} />
        </PageShell>
      )
    }
    const t = await getTranslator('navigation')
    return (
      <PageShell className="space-y-6 py-6 sm:py-8" width="standard" role="status">
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
  let latest: SyntheticPayrollView | null = null
  let loadFailed = false
  try {
    latest = await getLatestSyntheticPayroll(scope, administration.id)
  } catch {
    loadFailed = true
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
    : failureCode
      ? t(payrollLabErrorMessageKey(failureCode))
      : null
  const runReference = validRunId(query.run)
    ? query.run
    : failedLatestRun && validRunId(failedLatestRun.runId)
      ? failedLatestRun.runId
      : null
  const runCompleted = Boolean(latest && validRunId(query.run) && latest.runId === query.run && latest.status === 'SUCCEEDED')
  const renderedTrace = latest ? traceText(latest.trace) : null
  const amounts = new Map<string, string | null>(latest?.components.map((component) => [component.key, component.amount]) ?? [])
  const periodHeading = latest ? formatPeriodHeading(latest.payrollPeriod, locale) : ''

  return (
    <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
      <PageHeader
        actions={canRun ? (
          <form action={runSyntheticPayrollAction}>
            <Button type="submit"><Play aria-hidden="true" />{t('payrollLabRun')}</Button>
          </form>
        ) : undefined}
        description={t('payrollLabDescription')}
        title={t('payrollLab')}
      />

      {errorMessage ? (
        <Surface className="border-destructive/40 p-4 text-sm text-destructive" role="alert">
          <p>{errorMessage}</p>
          {failureCode ? <p className="mt-2"><span className="font-medium">{t('payrollLabErrorCode')}:</span> <code>{failureCode}</code></p> : null}
          {runReference ? <p className="mt-1"><span className="font-medium">{t('payrollLabRunReference')}:</span> <code>{runReference}</code></p> : null}
        </Surface>
      ) : null}
      {runCompleted ? <Surface className="border-success/50 p-4 text-sm text-success" role="status">{t('payrollLabRunCompleted')}</Surface> : null}

      {!latest ? (
        <EmptyState
          description={loadFailed ? t('payrollLabRunUnavailable') : t('payrollLabEmptyDescription')}
          icon={<Calculator />}
          title={loadFailed ? t('payrollLabRunUnavailable') : t('payrollLabEmptyTitle')}
        />
      ) : (
        <>
          <Surface className="p-4 sm:p-6">
            <SectionHeader
              actions={<Badge tone={statusTone(latest.status)}>{latest.status}</Badge>}
              description={`${t('payrollLabPayrollAdministration')}: ${administration.displayName}`}
              title={`${t('payrollLabTestEmployee')} · ${periodHeading}`}
            />
            <div className="mt-6">
              <AmountList
                fields={PAYROLL_AMOUNT_FIELDS.summary.map(({ key, label }) => ({ key, label: t(label) }))}
                amounts={amounts}
                locale={locale}
                featured
              />
            </div>
          </Surface>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <Surface className="p-4 sm:p-6">
              <SectionHeader title={t('payrollLabDeductions')} />
              <div className="mt-5">
                <AmountList
                  fields={PAYROLL_AMOUNT_FIELDS.deductions.map(({ key, label }) => ({ key, label: t(label) }))}
                  amounts={amounts}
                  locale={locale}
                />
              </div>
            </Surface>

            <Surface className="p-4 sm:p-6">
              <SectionHeader title={t('payrollLabEmployerCosts')} />
              <div className="mt-5">
                <AmountList
                  fields={PAYROLL_AMOUNT_FIELDS.employer.map(({ key, label }) => ({ key, label: t(label) }))}
                  amounts={amounts}
                  locale={locale}
                />
              </div>
            </Surface>
          </div>

          <Surface className="p-4 sm:p-6">
            <SectionHeader title={t('payrollLabRunStatus')} />
            <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetadataItem label={t('payrollLabPeriod')} value={formatPeriod(latest.payrollPeriod)} />
              <MetadataItem label={t('payrollLabRunType')} value={latest.runType} />
              <MetadataItem label={t('payrollLabRunId')} value={latest.runId} mono />
              <MetadataItem label={t('payrollLabEmployee')} value={latest.employeeId} mono />
              <MetadataItem label={t('payrollLabRuleComposition')} value={latest.rulePackageCompositionId} mono />
              <MetadataItem label={t('payrollLabEngineVersion')} value={latest.engineVersion} mono />
              <MetadataItem label={t('payrollLabSourceHash')} value={latest.sourceHash} mono />
              <MetadataItem label={t('payrollLabInputHash')} value={latest.inputHash} mono />
              <MetadataItem label={t('payrollLabResultHash')} value={latest.resultHash ?? '—'} mono />
              <MetadataItem label={t('payrollLabCreatedAt')} value={formatDateTime(latest.createdAt, locale)} />
              <MetadataItem label={t('payrollLabStartedAt')} value={formatDateTime(latest.startedAt, locale)} />
              <MetadataItem label={t('payrollLabFinishedAt')} value={formatDateTime(latest.finishedAt, locale)} />
            </dl>
          </Surface>

          <div className="grid gap-4 lg:grid-cols-2">
            <Surface className="min-w-0 p-4 sm:p-6">
              <SectionHeader title={t('payrollLabControls')} />
              {latest.controls.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{t('payrollLabNoControls')}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {latest.controls.map((control) => (
                    <li className="flex min-w-0 flex-col gap-2 border-t border-subtle pt-3 sm:flex-row sm:items-start sm:justify-between" key={control.key}>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium text-foreground">{control.key}</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(control.details, null, 2)}</pre>
                      </div>
                      <Badge tone={controlTone(control.status)}>{controlStatusLabel(control.status, t)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            <Surface className="min-w-0 p-4 sm:p-6">
              <SectionHeader title={t('payrollLabTrace')} />
              {renderedTrace ? (
                <details className="mt-4 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">{t('payrollLabTrace')}</summary>
                  <pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{renderedTrace}</pre>
                </details>
              ) : <p className="mt-4 text-sm text-muted-foreground">{t('payrollLabNoTrace')}</p>}
            </Surface>
          </div>
        </>
      )}
    </PageShell>
  )
}
