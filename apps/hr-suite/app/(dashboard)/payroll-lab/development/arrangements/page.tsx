import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import {
  SYNTHETIC_ARRANGEMENT_FIXTURES,
  type ArrangementSalaryStrategy,
} from '@/lib/payroll/arrangement-foundation'
import {
  createSyntheticArrangementAssignmentAction,
  resolveArrangementCompositionAction,
} from '../../arrangements/actions'
import { loadArrangementFoundationPage } from '@/lib/payroll/arrangement-service'
import type { ArrangementServiceError } from '@/lib/payroll/arrangement-service'
import { getTranslator } from '@/lib/i18n/server'

type DevelopmentQuery = {
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

export default async function DevelopmentArrangementsPage({
  searchParams,
}: {
  searchParams?: Promise<DevelopmentQuery>
}) {
  if (process.env.NODE_ENV === 'production') redirect('/geen-toegang')
  const t = await getTranslator('navigation')
  let data
  try {
    data = await loadArrangementFoundationPage({ requireAccess: async () => await requireComponentLibraryAccess(true) })
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    const unavailable = (error as ArrangementServiceError).code === 'ARRANGEMENT_STORAGE_UNAVAILABLE'
      || (error as ArrangementServiceError).code === 'ARRANGEMENT_DATA_INVALID'
    return <PageShell className="space-y-6 py-6 sm:py-8" role="status">
      <PageHeader title={t('arrangementsDevelopmentTitle')} description={t('arrangementsUnavailable')} />
      <Surface className="p-5"><p>{unavailable ? t('arrangementsStorageUnavailable') : t('arrangementsUnavailable')}</p></Surface>
    </PageShell>
  }

  const query = await searchParams
  const fixtureCode = single(query?.fixture)
  const snapshotId = single(query?.snapshotId)
  const errorKey = ERROR_TRANSLATION_KEYS[single(query?.error) ?? '']
  const successKey = single(query?.saved) === '1'
    ? 'arrangementsAssignmentSaved'
    : single(query?.snapshot) === '1'
      ? 'arrangementsSnapshotSaved'
      : undefined

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('arrangementsDevelopmentTitle')} description={t('arrangementsDevelopmentDescription', { administration: data.administrationName })} />
    <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/payroll-lab/arrangements">{t('arrangementsBackToCatalogue')}</Link>
    <Surface className="space-y-2 border border-warning/50 bg-warning/10 p-4" role="note">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="warning">{t('arrangementsDevelopmentTestOnly')}</Badge><h2 className="font-semibold">{t('arrangementsDevelopmentBannerTitle')}</h2></div>
      <p className="text-sm text-muted-foreground">{t('arrangementsDevelopmentBannerDescription')}</p>
      <p className="text-sm font-medium">{t('arrangementsAdminActionScope', { administration: data.administrationName })}</p>
    </Surface>
    {errorKey ? <Surface className="border border-border p-4" role="alert"><p>{t(errorKey)}</p></Surface> : null}
    {successKey ? <Surface className="border border-border p-4" role="status">
      <p>{t(successKey)}</p>
      {snapshotId && fixtureCode ? <p className="mt-1 text-sm text-muted-foreground">{t('arrangementsSnapshotReference')}: <code>{snapshotId}</code></p> : null}
    </Surface> : null}

    <section aria-labelledby="arrangement-fixtures-heading" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold" id="arrangement-fixtures-heading">{t('arrangementsFixturesTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('arrangementsFixturesDescription')}</p>
      </div>
      <ul className="space-y-3">
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

          return <li key={fixture.code}>
            <Surface className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)] sm:p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold">{fixture.displayName}</h3>
                  <Badge tone="neutral">{t('arrangementsSyntheticOnly')}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground"><code>{fixture.code}</code></p>
                <p className="mt-2 text-sm">{t('arrangementsSalaryStrategy')}: {t(STRATEGY_TRANSLATION_KEYS[fixture.salaryStrategy])}</p>
                <p className="text-sm text-muted-foreground">{t('arrangementsEffectiveFrom')}: {fixture.effectiveFrom}</p>

                {assignment ? <div className="mt-3 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
                  <p className="font-medium">{t('arrangementsPrimaryAssignment')}: {assignmentLabel}</p>
                  <p className="text-sm text-muted-foreground">{t('arrangementsExactlyOnePrimary')} · {t('arrangementsEffectiveFrom')}: {assignment.effective_from}</p>
                </div> : null}
              </div>

              <div className="space-y-3">
                {assignment ? data.canWrite ? <form action={resolveArrangementCompositionAction} className="space-y-2">
                  <input type="hidden" name="fixtureCode" value={fixture.code} />
                  <label className="grid gap-1 text-sm">
                    <span>{t('arrangementsCalculationDate')}</span>
                    <TextInput type="date" name="asOfDate" defaultValue="2026-09-30" required />
                  </label>
                  <Button type="submit" variant="secondary">{t('arrangementsResolveComposition')}</Button>
                </form> : <p className="text-sm text-muted-foreground">{t('arrangementsWritePermissionRequired')}</p> : data.canWrite && choices.length > 0 ? <form action={createSyntheticArrangementAssignmentAction} className="space-y-2">
                  <input type="hidden" name="fixtureCode" value={fixture.code} />
                  <label className="grid gap-1 text-sm">
                    <span>{t('arrangementsSelectPackage')}</span>
                    <DropdownSelect name="packageId" required defaultValue={choices[0]?.id} searchable searchPlaceholder={t('arrangementsSelectPackage')}>
                      {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.displayName}</option>)}
                    </DropdownSelect>
                  </label>
                  <p className="text-sm text-muted-foreground">{t('arrangementsAssignmentStartsOn', { date: fixture.effectiveFrom })}</p>
                  <Button type="submit" variant="secondary">{t('arrangementsAssignPrimary')}</Button>
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
              </div>
            </Surface>
          </li>
        })}
      </ul>
    </section>
  </PageShell>
}
