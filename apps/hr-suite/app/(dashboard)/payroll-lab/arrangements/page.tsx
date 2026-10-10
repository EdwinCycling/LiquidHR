import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import {
  SYNTHETIC_ARRANGEMENT_FIXTURES,
  type ArrangementSalaryStrategy,
} from '@/lib/payroll/arrangement-foundation'
import {
  createSyntheticArrangementAssignmentAction,
  endArrangementPackageAvailabilityAction,
  extendArrangementPackageAvailabilityStartAction,
  makeArrangementPackagesAvailableAction,
  resolveArrangementCompositionAction,
} from './actions'
import { loadArrangementFoundationPage } from '@/lib/payroll/arrangement-service'
import type { ArrangementServiceError } from '@/lib/payroll/arrangement-service'
import { getTranslator } from '@/lib/i18n/server'

type ArrangementQuery = {
  activated?: string | string[]
  ended?: string | string[]
  availability?: string | string[]
  saved?: string | string[]
  snapshot?: string | string[]
  fixture?: string | string[]
  snapshotId?: string | string[]
  error?: string | string[]
}

const ERROR_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  'not-available': 'arrangementsErrorNotAvailable',
  'missing-assignment': 'arrangementsErrorMissingAssignment',
  'already-assigned': 'arrangementsErrorAlreadyAssigned',
  'invalid-input': 'arrangementsErrorInvalidInput',
  'version-unavailable': 'arrangementsErrorVersionUnavailable',
  'invalid-date': 'arrangementsErrorInvalidDate',
  'save-failed': 'arrangementsErrorSaveFailed',
}

const STRATEGY_TRANSLATION_KEYS = {
  DISCRETE_SCALE_STEP: 'arrangementsStrategy_DISCRETE_SCALE_STEP',
  OPEN_SALARY_BAND: 'arrangementsStrategy_OPEN_SALARY_BAND',
  FREELY_NEGOTIATED: 'arrangementsStrategy_FREELY_NEGOTIATED',
} as const satisfies Readonly<Record<ArrangementSalaryStrategy, string>>

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function PayrollArrangementsPage({
  searchParams,
}: {
  searchParams?: Promise<ArrangementQuery>
}) {
  const t = await getTranslator('navigation')
  let data
  try {
    data = await loadArrangementFoundationPage()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    const unavailable = (error as ArrangementServiceError).code === 'ARRANGEMENT_STORAGE_UNAVAILABLE'
      || (error as ArrangementServiceError).code === 'ARRANGEMENT_DATA_INVALID'
    return <PageShell className="space-y-6 py-6 sm:py-8" role="status">
      <PageHeader title={t('payrollArrangements')} description={t('arrangementsUnavailable')} />
      <Surface className="p-5">
        <p>{unavailable ? t('arrangementsStorageUnavailable') : t('arrangementsUnavailable')}</p>
      </Surface>
    </PageShell>
  }

  const query = await searchParams
  const fixtureCode = single(query?.fixture)
  const snapshotId = single(query?.snapshotId)
  const errorKey = ERROR_TRANSLATION_KEYS[single(query?.error) ?? '']
  const successKey = single(query?.ended) === '1'
    ? 'arrangementsAvailabilityEnded'
    : single(query?.availability) === 'extended'
      ? 'arrangementsAvailabilityStartExtended'
    : single(query?.activated) === '1'
    ? 'arrangementsPackagesActivated'
    : single(query?.saved) === '1'
      ? 'arrangementsAssignmentSaved'
      : single(query?.snapshot) === '1'
        ? 'arrangementsSnapshotSaved'
        : undefined
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('payrollArrangements')} description={t('arrangementsDescription', { administration: data.administrationName })} />
    {errorKey ? <Surface className="border border-border p-4" role="alert"><p>{t(errorKey)}</p></Surface> : null}
    {successKey ? <Surface className="border border-border p-4" role="status">
      <p>{t(successKey)}</p>
      {snapshotId && fixtureCode ? <p className="mt-1 text-sm text-muted-foreground">{t('arrangementsSnapshotReference')}: <code>{snapshotId}</code></p> : null}
    </Surface> : null}

    <Surface className="space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t('arrangementsFoundationTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('arrangementsFoundationNotice')}</p>
      <p className="text-sm text-muted-foreground">{t('arrangementsSyntheticScope')}</p>
    </Surface>

    <section aria-labelledby="arrangement-packages-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="arrangement-packages-heading" className="text-lg font-semibold">{t('arrangementsPackagesTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('arrangementsPackagesDescription')}</p>
        </div>
        {data.canWrite && data.packages.some((item) => !item.availability) ? <form action={makeArrangementPackagesAvailableAction} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityFrom')}</span><TextInput defaultValue="2026-09-01" name="effectiveFrom" required type="date" /></label>
          <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityThrough')}</span><TextInput name="effectiveTo" type="date" /></label>
          <Button type="submit">{t('arrangementsActivatePackages')}</Button>
        </form> : null}
      </div>
      {!data.canWrite && data.packages.some((item) => !item.available)
        ? <p className="text-sm text-muted-foreground">{t('arrangementsWritePermissionRequired')}</p>
        : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.packages.map(({ definition, availability, available }) => <Surface key={definition.id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{definition.displayName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{definition.id}</p>
            </div>
            <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium">
              {t(available ? 'arrangementsAvailable' : 'arrangementsNotAvailable')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t(definition.kind === 'COLLECTIVE_AGREEMENT' ? 'arrangementsCollectiveAgreement' : 'arrangementsCompanyPolicy')}</p>
          {availability ? <p className="text-sm text-muted-foreground">{t('arrangementsAvailabilityPeriod')}: {availability.effective_from} — {availability.effective_to ?? t('arrangementsOpenEnded')}</p> : null}
          {data.canWrite && available && availability && (() => {
            const earliestPackageDate = definition.versions.map((version) => version.effectiveFrom).sort()[0]
            return earliestPackageDate && availability.effective_from > earliestPackageDate
              ? <form action={extendArrangementPackageAvailabilityStartAction} className="flex flex-wrap items-end gap-3">
                <input name="packageId" type="hidden" value={definition.id} />
                <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityFrom')}</span><TextInput defaultValue={availability.effective_from} max={availability.effective_to ?? data.today} min={earliestPackageDate} name="effectiveFrom" required type="date" /></label>
                <Button type="submit" variant="secondary">{t('arrangementsExtendAvailabilityStart')}</Button>
              </form>
              : null
          })()}
          {data.canWrite && availability?.effective_to === null ? <form action={endArrangementPackageAvailabilityAction} className="flex flex-wrap items-end gap-3">
            <input name="packageId" type="hidden" value={definition.id} />
            <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityLastDate')}</span><TextInput defaultValue={data.today} min={availability.effective_from} name="effectiveTo" required type="date" /></label>
            <Button type="submit" variant="secondary">{t('arrangementsEndAvailability')}</Button>
          </form> : null}
          <ul className="space-y-2">
            {definition.versions.map((version) => <li key={version.version} className="rounded-[var(--radius-control)] bg-surface-subtle p-3 text-sm">
              <p className="font-medium">{t('arrangementsVersion')} {version.version}</p>
              <p className="text-muted-foreground">{version.effectiveFrom} — {version.effectiveTo ?? t('arrangementsOpenEnded')}</p>
              <p className="mt-1 text-muted-foreground">{version.supportedSalaryStrategies.map((strategy) => t(STRATEGY_TRANSLATION_KEYS[strategy])).join(', ')}</p>
              <a className="mt-1 inline-block text-primary underline underline-offset-2" href={version.sourceMetadata.sourceUrl} target="_blank" rel="noreferrer">
                {version.sourceMetadata.sourceTitle}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{t(version.sourceMetadata.status === 'SYNTHETIC_POLICY' ? 'arrangementsSyntheticSource' : 'arrangementsReferenceOnly')}</p>
            </li>)}
          </ul>
        </Surface>)}
      </div>
    </section>

    <section aria-labelledby="arrangement-fixtures-heading" className="space-y-3">
      <div>
        <h2 id="arrangement-fixtures-heading" className="text-lg font-semibold">{t('arrangementsFixturesTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('arrangementsFixturesDescription')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {SYNTHETIC_ARRANGEMENT_FIXTURES.map((fixture) => {
          const assignment = data.assignments.find((item) => item.fixture_code === fixture.code)
          const packageDefinition = assignment
            ? data.packages.find((item) => item.definition.id === assignment.package_id)?.definition
            : undefined
          const hasUnactivatedChoice = fixture.allowedPackageIds.some((packageId) =>
            data.packages.find((item) => item.definition.id === packageId)?.availability === null)
          const choices = fixture.allowedPackageIds
            .filter((packageId) => {
              const availability = data.packages.find((item) => item.definition.id === packageId)?.availability
              return availability !== null && availability !== undefined
                && availability.effective_from <= fixture.effectiveFrom
                && (availability.effective_to === null || fixture.effectiveFrom <= availability.effective_to)
                && availability.effective_from <= data.today
                && (availability.effective_to === null || data.today <= availability.effective_to)
            })
            .map((packageId) => data.packages.find((item) => item.definition.id === packageId)?.definition)
            .filter((item) => item !== undefined)
          const snapshots = data.snapshots.filter((item) => item.content.employment.fixtureCode === fixture.code)
          const latestSnapshot = snapshots[0]
          const assignmentLabel = packageDefinition?.displayName
            ?? latestSnapshot?.content.arrangement.displayName
            ?? assignment?.package_id

          return <Surface key={fixture.code} className="space-y-4 p-5">
            <div>
              <h3 className="font-semibold">{fixture.displayName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{fixture.code} · {t('arrangementsSyntheticOnly')}</p>
              <p className="mt-2 text-sm">{t('arrangementsSalaryStrategy')}: {t(STRATEGY_TRANSLATION_KEYS[fixture.salaryStrategy])}</p>
              <p className="text-sm text-muted-foreground">{t('arrangementsEffectiveFrom')}: {fixture.effectiveFrom}</p>
            </div>

            {assignment ? <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3">
              <p className="font-medium">{t('arrangementsPrimaryAssignment')}: {assignmentLabel}</p>
              <p className="text-sm text-muted-foreground">{t('arrangementsExactlyOnePrimary')} · {t('arrangementsEffectiveFrom')}: {assignment.effective_from}</p>
              {data.canWrite ? <form action={resolveArrangementCompositionAction} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="fixtureCode" value={fixture.code} />
                <label className="grid gap-1 text-sm">
                  <span>{t('arrangementsCalculationDate')}</span>
                  <TextInput type="date" name="asOfDate" defaultValue="2026-09-30" required />
                </label>
                <Button type="submit">{t('arrangementsResolveComposition')}</Button>
              </form> : <p className="mt-2 text-sm text-muted-foreground">{t('arrangementsWritePermissionRequired')}</p>}
            </div> : data.canWrite && choices.length > 0 ? <form action={createSyntheticArrangementAssignmentAction} className="space-y-3">
              <input type="hidden" name="fixtureCode" value={fixture.code} />
              <label className="grid gap-1 text-sm">
                <span>{t('arrangementsSelectPackage')}</span>
                <DropdownSelect name="packageId" required defaultValue={choices[0]?.id} searchable searchPlaceholder={t('arrangementsSelectPackage')}>
                  {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.displayName}</option>)}
                </DropdownSelect>
              </label>
              <p className="text-sm text-muted-foreground">{t('arrangementsAssignmentStartsOn', { date: fixture.effectiveFrom })}</p>
              <Button type="submit">{t('arrangementsAssignPrimary')}</Button>
            </form> : <p className="text-sm text-muted-foreground">{t(!data.canWrite
              ? 'arrangementsWritePermissionRequired'
              : hasUnactivatedChoice
                ? 'arrangementsActivateBeforeAssigning'
                : 'arrangementsNoAvailableAssignmentChoice')}</p>}

            {snapshots.length > 0 ? <div className="space-y-2 border-t border-border pt-3">
              <h4 className="text-sm font-semibold">{t('arrangementsCompositionSnapshots')}</h4>
              {snapshots.map(({ row, content }) => <div key={row.id} className="rounded-[var(--radius-control)] bg-surface-subtle p-3 text-sm">
                <p>{content.asOfDate} · {content.arrangement.version} · {t(STRATEGY_TRANSLATION_KEYS[content.primaryAssignment.salaryStrategy])}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{t('arrangementsSnapshotHash')}: {row.snapshot_hash}</p>
              </div>)}
            </div> : null}
          </Surface>
        })}
      </div>
    </section>
  </PageShell>
}
