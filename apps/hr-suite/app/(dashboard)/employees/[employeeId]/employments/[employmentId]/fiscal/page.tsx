import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { ScrollableTabs, TabLink } from '@/components/patterns/scrollable-tabs'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button, buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { AuthorizationError } from '@/lib/auth/permissions'
import {
  EmploymentPayrollTaxProfileError,
  getEmploymentPayrollTaxDossier,
} from '@/lib/employment/employment-payroll-tax-profile-service'
import { formatDate, formatDateTime } from '@/lib/preferences/formatters'
import { getUserPreferences } from '@/lib/preferences/server'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { confirmEmploymentPayrollTaxProfileAction } from './actions'

type FiscalTab = 'general' | 'taxes' | 'other' | 'insurance' | 'taxBenefit' | 'zvw' | 'notes'
type PageProps = {
  params: Promise<{ employeeId: string; employmentId: string }>
  searchParams: Promise<{ tab?: string; saved?: string; error?: string }>
}

const tabs: readonly FiscalTab[] = ['general', 'taxes', 'other', 'insurance', 'taxBenefit', 'zvw', 'notes']

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function versionRows(profiles: Awaited<ReturnType<typeof getEmploymentPayrollTaxDossier>>['taxProfiles']) {
  const groups = new Map<string, typeof profiles[number][]>()
  for (const profile of profiles) {
    const key = `${profile.employment_id}:${profile.income_relationship_id}`
    const items = groups.get(key) ?? []
    items.push(profile)
    groups.set(key, items)
  }
  const rows: Array<{ profile: typeof profiles[number]; effectiveTo: string | null }> = []
  for (const items of groups.values()) {
    const byStart = new Map<string, typeof profiles[number]>()
    for (const profile of [...items].sort((left, right) => left.version_number - right.version_number)) {
      byStart.set(profile.effective_from, profile)
    }
    const ordered = [...byStart.values()].sort((left, right) => left.effective_from.localeCompare(right.effective_from))
    ordered.forEach((profile, index) => {
      const next = ordered[index + 1]
      const successorEnd = next ? new Date(`${next.effective_from}T00:00:00.000Z`) : null
      if (successorEnd) successorEnd.setUTCDate(successorEnd.getUTCDate() - 1)
      const derivedTo = successorEnd?.toISOString().slice(0, 10) ?? null
      const effectiveTo = profile.effective_to === null
        ? derivedTo
        : derivedTo === null || profile.effective_to < derivedTo ? profile.effective_to : derivedTo
      rows.push({ profile, effectiveTo })
    })
  }
  return rows.sort((left, right) => right.profile.version_number - left.profile.version_number
    || right.profile.effective_from.localeCompare(left.profile.effective_from))
}

function detailValue(label: string, value: string | number | null | undefined, notRecorded: string) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value === null || value === undefined || value === '' ? notRecorded : value}</dd></div>
}

function safeSourceReference(value: string | null | undefined, unavailable: string): string {
  if (!value) return unavailable
  if (/\b\d{8,9}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{10}\b|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value)) return unavailable
  return value
}

export default async function EmploymentFiscalDossierPage({ params, searchParams }: PageProps) {
  const [{ employeeId, employmentId }, query, locale, preferences, t] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getUserPreferences(),
    getTranslator('employment'),
  ])
  let dossier: Awaited<ReturnType<typeof getEmploymentPayrollTaxDossier>>
  try {
    dossier = await getEmploymentPayrollTaxDossier(employeeId, employmentId)
  } catch (error) {
    if (error instanceof AuthorizationError || (error instanceof EmploymentPayrollTaxProfileError && error.status === 403)) {
      redirect('/geen-toegang')
    }
    if (error instanceof EmploymentPayrollTaxProfileError && error.status === 404) notFound()
    throw error
  }

  const requestedTab = query.tab as FiscalTab
  const tab = tabs.includes(requestedTab) ? requestedTab : 'general'
  const copy = (key: string, values?: Record<string, string | number>) => t(`fiscalDossier.${key}`, values)
  const today = isoToday()
  const profiles = versionRows(dossier.taxProfiles)
  const activeProfiles = profiles.filter(({ profile, effectiveTo }) => profile.effective_from <= today
    && (effectiveTo === null || effectiveTo >= today))
  const activeIncomeRelationships = dossier.incomeRelationships.filter((row) => row.relationshipType === 'EMPLOYMENT'
    && row.reportingStatus !== 'DRAFT' && row.startsOn <= today && (row.endsOn === null || row.endsOn >= today)
    && row.validFrom <= today && (row.validUntil === null || row.validUntil >= today))
  const currentProfile = activeIncomeRelationships.length === 1
    ? activeProfiles.filter(({ profile }) => profile.income_relationship_id === activeIncomeRelationships[0]?.incomeRelationshipId)
      .sort((left, right) => right.profile.version_number - left.profile.version_number)[0]?.profile ?? null
    : null
  const currentSchedule = dossier.schedules.find((schedule) => schedule.startsOn <= today
    && (schedule.endsOn === null || schedule.endsOn >= today))
  const currentTaxNumber = dossier.payrollTaxNumbers.find((row) => row.isPrimary
    && row.validFrom <= today && (row.validUntil === null || row.validUntil >= today))
  const eligibleIncomeRelationships = dossier.incomeRelationships.filter((row) =>
    row.relationshipType === 'EMPLOYMENT' && row.reportingStatus !== 'DRAFT',
  )
  const dateLabel = (value: string | null) => value ? formatDate(value, { locale, dateFormat: preferences.dateFormat }) : copy('notAvailable')
  const periodLabel = (from: string, to: string | null) => `${dateLabel(from)} – ${to ? dateLabel(to) : copy('openEnded')}`
  const errorMessage = query.error === 'invalid' ? copy('profileInvalid')
    : query.error === 'blocked' ? copy('profileBlocked')
      : query.error === 'unavailable' ? copy('profileUnavailable') : null
  const currentProfileForRelationship = (incomeRelationshipId: string) => activeProfiles
    .filter(({ profile }) => profile.income_relationship_id === incomeRelationshipId)
    .sort((left, right) => right.profile.version_number - left.profile.version_number)[0]?.profile
  const link = (target: FiscalTab) => `/employees/${employeeId}/employments/${employmentId}/fiscal?tab=${target}`
  const reportingStatusLabel = (status: string) => status === 'READY' ? copy('filingReady') : status === 'DRAFT' ? copy('filingDraft') : copy('filingOther')
  const ageCategoryLabel = dossier.ageCategory === 'UNDER_AOW' ? copy('underAow')
    : dossier.ageCategory === 'AT_OR_ABOVE_AOW' ? copy('atOrAboveAow') : copy('notRecorded')

  return <PageShell className="space-y-6 py-6 lg:py-9">
    <Link className="inline-flex items-center text-sm font-semibold text-primary hover:underline" href={`/employees/${employeeId}/employments/${employmentId}?tab=overview&view=expanded`}>{copy('back')}</Link>
    <PageHeader title={copy('title')} description={`${dossier.employee.displayName} · ${copy('employmentNumber')} ${dossier.employment.number} · ${dossier.administration.name}`} />
    <p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface px-4 py-3 text-sm text-foreground">{copy('payrollNotGuaranteed')}</p>

    {query.saved === 'saved' ? <p className="border-l-2 border-success-border pl-3 text-sm text-success" role="status">{copy('profileSaved')}</p> : null}
    {errorMessage ? <p className="border-l-2 border-destructive-border pl-3 text-sm text-destructive" role="alert">{errorMessage}</p> : null}

    <nav aria-label={copy('tabsLabel')}>
      <ScrollableTabs ariaLabel={copy('tabsLabel')} leftLabel={t('previous')} rightLabel={t('next')} contentProps={{ role: 'tablist' }}>
        {tabs.map((item) => <TabLink active={tab === item} aria-label={copy(`tabs.${item}`)} href={link(item)} id={`fiscal-tab-${item}`} key={item} role="tab">{copy(`tabs.${item}`)}</TabLink>)}
      </ScrollableTabs>
    </nav>

    <div aria-labelledby={`fiscal-tab-${tab}`} id={`fiscal-panel-${tab}`} role="tabpanel" tabIndex={0}>
      {tab === 'general' ? <div className="space-y-4">
        <Surface className="space-y-4 p-5 sm:p-6">
          <SectionHeader title={copy('tabs.general')} />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detailValue(copy('administration'), dossier.administration.name, copy('notAvailable'))}
            {detailValue(copy('employeeNumber'), dossier.employee.employeeNumber, copy('notAvailable'))}
            {detailValue(copy('employmentNumber'), dossier.employment.number, copy('notAvailable'))}
            {detailValue(copy('employmentPeriod'), periodLabel(dossier.employment.startsOn, dossier.employment.endsOn), copy('notAvailable'))}
            {detailValue(copy('employerTaxNumber'), currentTaxNumber?.payrollTaxNumber, copy('notConfigured'))}
            {detailValue(copy('classificationStatus'), currentProfile ? copy('profileRecorded') : copy('profileMissing'), copy('profileMissing'))}
          </dl>
          <Link className={buttonClasses({ variant: 'secondary', size: 'sm' })} href={`/employees/${employeeId}?tab=personal`}>{copy('personalDetails')}</Link>
        </Surface>
        <Surface className="space-y-4 p-5 sm:p-6">
          <SectionHeader title={copy('incomeRelationships')} />
          {dossier.incomeRelationships.length === 0 ? <p className="text-sm text-muted-foreground">{copy('noIkv')}</p> : <ul className="divide-y divide-subtle border-y border-subtle">{dossier.incomeRelationships.map((row) => {
            const profile = currentProfileForRelationship(row.incomeRelationshipId)
            return <li className="grid gap-1 py-3 text-sm sm:grid-cols-2" key={row.linkId}>
              <p className="font-semibold">{copy('ikvNumber')} {row.ikvNumber}</p>
              <p className="text-muted-foreground">{copy('period')}: {periodLabel(row.validFrom, row.validUntil)}</p>
              <p className="text-muted-foreground">{copy('incomeType')}: {row.relationshipType === 'EMPLOYMENT' ? copy('relationshipTypeEmployment') : copy('relationshipTypeOther')}</p>
              <p className="text-muted-foreground">{copy('reportingStatus')}: {reportingStatusLabel(row.reportingStatus)}</p>
              <p className="text-muted-foreground">{copy('payrollTaxCredit')}: {profile ? copy(profile.payroll_tax_credit_applies ? 'yes' : 'no') : copy('profileMissing')}</p>
            </li>
          })}</ul>}
        </Surface>
      </div> : null}

      {tab === 'taxes' ? <div className="space-y-4">
        <Surface className="space-y-4 p-5 sm:p-6">
          <SectionHeader title={copy('supportedTitle')} description={copy('supportedDescription')} />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detailValue(copy('taxYear'), '2026', copy('notAvailable'))}
            {detailValue(copy('residenceCountry'), currentProfile?.residence_country_code === 'NL' ? copy('netherlands') : null, copy('notAvailable'))}
            {detailValue(copy('tableColor'), currentProfile?.wage_tax_table === 'WHITE' ? copy('whiteTable') : currentProfile ? copy('unsupportedVariant') : null, copy('notAvailable'))}
            {detailValue(copy('calculationMethod'), currentProfile?.herleiding_code === 'STD' ? copy('standardMethod') : currentProfile ? copy('unsupportedVariant') : null, copy('notAvailable'))}
            {detailValue(copy('tableBasis'), currentProfile?.time_period === 'MONTH' ? copy('monthly') : currentProfile ? copy('unsupportedVariant') : null, copy('notAvailable'))}
            {detailValue(copy('regularWageOnly'), currentProfile ? copy(currentProfile.regular_wage_only ? 'yes' : 'no') : null, copy('notAvailable'))}
            {detailValue(copy('fullPeriod'), currentProfile ? copy(currentProfile.full_period_only ? 'yes' : 'no') : null, copy('notAvailable'))}
            {detailValue(copy('specialSituation'), currentProfile ? copy(currentProfile.has_special_situation ? 'unsupportedVariant' : 'no') : null, copy('notAvailable'))}
            {detailValue(copy('payrollTaxCredit'), currentProfile ? copy(currentProfile.payroll_tax_credit_applies ? 'yes' : 'no') : copy('notAvailable'), copy('notAvailable'))}
          </dl>
          <div className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4">
            <h3 className="font-semibold">{copy('calculationLimitTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy('calculationLimitDescription')}</p>
          </div>
        </Surface>

        <Surface className="space-y-4 p-5 sm:p-6">
          <SectionHeader title={copy('profileHistory')} />
          {profiles.length === 0 ? <p className="text-sm text-muted-foreground">{copy('historyEmpty')}</p> : <ol className="divide-y divide-subtle border-y border-subtle">{profiles.map(({ profile, effectiveTo }) => <li className="grid gap-2 py-3 text-sm sm:grid-cols-2" key={profile.id}>
            <div><p className="font-semibold">{copy('version', { version: profile.version_number })} · {periodLabel(profile.effective_from, effectiveTo)}</p><p className="mt-1 text-muted-foreground">{copy('payrollTaxCredit')}: {copy(profile.payroll_tax_credit_applies ? 'yes' : 'no')}</p></div>
            <div><p className="font-medium">{profile.source_classification === 'EMPLOYEE_DECLARATION' ? copy('employeeDeclaration') : copy('hrAdminConfirmed')}</p><p className="mt-1 break-words text-muted-foreground">{copy('sourceReference')}: {safeSourceReference(profile.source_reference, copy('notAvailable'))}</p><p className="mt-1 text-muted-foreground">{copy('recordedOn')}: {formatDateTime(profile.confirmed_at, { locale, dateFormat: preferences.dateFormat, timeFormat: preferences.timeFormat })}</p></div>
          </li>)}</ol>}
        </Surface>

        <Surface className="space-y-4 p-5 sm:p-6">
          <SectionHeader title={copy('recordProfile')} description={copy('sourceReferenceHelp')} />
          {eligibleIncomeRelationships.length === 0 ? <p className="text-sm text-muted-foreground">{copy('noIkv')}</p> : <form action={confirmEmploymentPayrollTaxProfileAction} className="grid gap-4 sm:grid-cols-2">
            <input name="employeeId" type="hidden" value={employeeId} />
            <input name="employmentId" type="hidden" value={employmentId} />
            <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">{copy('selectIkv')}
              <select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" name="incomeRelationshipId" required defaultValue="">
                <option disabled value="">{copy('selectIkv')}</option>
                {eligibleIncomeRelationships.map((row) => <option key={row.linkId} value={row.incomeRelationshipId}>{copy('ikvNumber')} {row.ikvNumber} · {periodLabel(row.validFrom, row.validUntil)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">{copy('effectiveFrom')}<TextInput name="effectiveFrom" required type="date" /></label>
            <label className="grid gap-1 text-sm font-medium">{copy('effectiveTo')}<TextInput name="effectiveTo" type="date" /></label>
            <label className="grid gap-1 text-sm font-medium">{copy('payrollTaxCredit')}
              <select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" name="payrollTaxCreditApplies" required defaultValue="">
                <option disabled value="">{copy('selectValue')}</option><option value="true">{copy('yes')}</option><option value="false">{copy('no')}</option>
              </select>
            </label>
            <div className="grid gap-1 text-sm font-medium"><span>{copy('sourceType')}</span><p className="rounded-[var(--radius-control)] border border-subtle bg-muted/30 px-3 py-2 font-normal">{copy('hrAdminConfirmed')}</p><input name="sourceClassification" type="hidden" value="HR_ADMIN_CONFIRMED" /></div>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">{copy('sourceReference')}<TextInput autoComplete="off" maxLength={160} name="sourceReference" placeholder={copy('sourceReferencePlaceholder')} required /></label>
            <div className="sm:col-span-2"><Button type="submit">{copy('recordProfile')}</Button></div>
          </form>}
        </Surface>
      </div> : null}

      {tab === 'other' ? <Surface className="space-y-4 p-5 sm:p-6"><SectionHeader title={copy('otherTitle')} description={copy('otherDescription')} /><dl className="grid gap-4 sm:grid-cols-2">{detailValue(copy('writtenContract'), null, copy('notRecorded'))}{detailValue(copy('onCallAgreement'), currentSchedule ? copy(currentSchedule.isOnCall ? 'yes' : 'no') : null, copy('notRecorded'))}{detailValue(copy('yearHoursNorm'), null, copy('notRecorded'))}{detailValue(copy('ageCategory'), ageCategoryLabel, copy('notRecorded'))}</dl></Surface> : null}

      {tab === 'insurance' ? <Surface className="space-y-4 p-5 sm:p-6"><SectionHeader title={copy('insuranceTitle')} description={copy('insuranceDescription')} /><p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4 text-sm">{copy('insuranceCalculationUnavailable')}</p></Surface> : null}
      {tab === 'taxBenefit' ? <Surface className="space-y-4 p-5 sm:p-6"><SectionHeader title={copy('taxBenefitTitle')} description={copy('taxBenefitDescription')} /><p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4 text-sm">{copy('taxBenefitUnavailable')}</p></Surface> : null}
      {tab === 'zvw' ? <Surface className="space-y-4 p-5 sm:p-6"><SectionHeader title={copy('zvwTitle')} description={copy('zvwDescription')} /><p className="rounded-[var(--radius-control)] border border-warning-border bg-warning-surface p-4 text-sm">{copy('zvwUnavailable')}</p></Surface> : null}
      {tab === 'notes' ? <Surface className="space-y-4 p-5 sm:p-6"><SectionHeader title={copy('notesTitle')} description={copy('notesDescription')} />{dossier.auditHistory.length === 0 ? <p className="text-sm text-muted-foreground">{copy('historyEmpty')}</p> : <ol className="divide-y divide-subtle border-y border-subtle">{dossier.auditHistory.map((audit) => {
        const profile = dossier.taxProfiles.find((row) => row.id === audit.taxProfileId)
        return <li className="grid gap-1 py-3 text-sm sm:grid-cols-2" key={audit.id}><p className="font-semibold">{profile ? copy('version', { version: profile.version_number }) : copy('recordedByHr')}</p><p className="text-muted-foreground">{copy('recordedOn')}: {formatDateTime(audit.recordedAt, { locale, dateFormat: preferences.dateFormat, timeFormat: preferences.timeFormat })}</p><p className="break-words text-muted-foreground sm:col-span-2">{copy('sourceReference')}: {safeSourceReference(audit.sourceReference, copy('notAvailable'))}</p></li>
      })}</ol>}</Surface> : null}
    </div>
  </PageShell>
}
