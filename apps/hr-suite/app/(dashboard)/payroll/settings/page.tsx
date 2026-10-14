import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollCalendarPlanner } from '@/components/payroll/payroll-calendar-planner'
import { Surface } from '@/components/ui/surface'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { createPayrollCalculationRepository } from '@/lib/payroll/calculation-repository'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'

export default async function PayrollSettingsPage() {
  const [access, t, locale] = await Promise.all([requireComponentLibraryAccess(false), getTranslator('payrollProfessional'), getLocale()])
  const repository = createPayrollCalculationRepository()
  const periods = repository.listCalendarPeriods
    ? await repository.listCalendarPeriods(access.scope, access.administration.id, 24)
    : (await repository.listPayrollPeriods(access.scope, access.administration.id, 24)).map((period) => ({
        period_year: period.period_year,
        period_month: period.period_month,
        period_number: period.period_number ?? period.period_month,
        periodicity: period.periodicity ?? 'MONTHLY' as const,
        period_kind: period.period_kind ?? 'REGULAR' as const,
        starts_on: period.starts_on,
        ends_on: period.ends_on,
        planned_payment_date: period.planned_payment_date ?? null,
        status: period.status,
      }))
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('settings')} description={t('settingsDescription')} />
    <PayrollProfessionalNavigation active="settings" labels={nav} />
    <PayrollCalendarPlanner
      defaultYear={new Date().getUTCFullYear()}
      locale={locale}
      periods={periods.map((period) => ({
        year: period.period_year,
        month: period.period_month,
        periodNumber: period.period_number,
        periodicity: period.periodicity,
        periodKind: period.period_kind,
        startsOn: period.starts_on,
        endsOn: period.ends_on,
        status: period.status,
        plannedPaymentDate: period.planned_payment_date ?? null,
      }))}
      labels={Object.fromEntries([
        'calendarTitle','calendarDescription','calendarConfigTitle','calendarConfigNotRecorded',
        'calendarCurrentPeriods','calendarNoSavedPeriods','calendarMonth',
        'calendarPaymentDate','calendarPlanTitle','calendarPlanDescription','calendarRegularName','calendarNotPersisted',
        'calendarYear','calendarPeriodicity','calendarAnchorDate','calendarYearAssignment','calendarYearByStart',
        'calendarYearByEnd','calendarPaymentRule','calendarDeadlineRule','calendarDateAnchor','calendarUnspecified',
        'calendarPeriodStart','calendarPeriodEnd','calendarOffsetDays','calendarGenerate','calendarPreviewTitle',
        'calendarPeriodCount','calendarPeriodNumber','calendarDeadline','calendarCorrection','calendarAdditional','calendarMonthlyCalculationScope',
        'calendarFrequencyNotValidated','calendarFrequency_MONTHLY','calendarFrequency_FOUR_WEEKLY',
        'calendarFrequency_WEEKLY','calendarFrequency_BIWEEKLY','calendarFrequency_QUARTERLY',
        'calendarFrequency_SEMI_ANNUAL','calendarFrequency_ANNUAL','calendarError_CALENDAR_IDENTITY_INVALID',
        'calendarError_CALENDAR_YEAR_INVALID','calendarError_CALENDAR_EFFECTIVE_RANGE_INVALID',
        'calendarError_CALENDAR_ANCHOR_REQUIRED','calendarError_CALENDAR_YEAR_ASSIGNMENT_REQUIRED',
        'calendarError_CALENDAR_DATE_INVALID','calendarError_CALENDAR_DATE_RULE_INVALID',
        'calendarError_CALENDAR_EFFECTIVE_RANGE_INCOMPLETE','calendarError_CALENDAR_PERIODS_OVERLAP',
        'calendarErrorFallback','status','period_OPEN','period_DRAFT','period_CLOSED','periodStatusUnknown',
      ].map((key) => [key, t(key)]))}
    />
    <Surface className="space-y-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{t('activePayrollAdministration')}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">{t('administration')}</dt><dd className="mt-1 font-medium">{access.administration.displayName}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('capability')}</dt><dd className="mt-1 font-medium">{access.administration.capabilityEnabled ? t('enabled') : t('disabled')}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('status')}</dt><dd className="mt-1 font-medium">{t(access.administration.status === 'ACTIVE' ? 'administration_ACTIVE' : 'administration_SUSPENDED')}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('administrationManagement')}</dt><dd className="mt-1 font-medium">{access.canCopy ? t('available') : t('readOnly')}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{t('settingsScopeNotice')}</p>
    </Surface>
  </PageShell>
}
