import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import { PageToolbar } from '@/components/patterns/page-toolbar'
import { FilterBar } from '@/components/patterns/filter-bar'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { Translator } from '@/lib/i18n/translator'
import type { ArrangementPackage, ArrangementPackageVersion } from '@/lib/payroll/arrangement-foundation'
import type { ArrangementFoundationPageData } from '@/lib/payroll/arrangement-service'
import {
  endArrangementPackageAvailabilityAction,
  extendArrangementPackageAvailabilityStartAction,
  makeArrangementPackagesAvailableAction,
} from '@/app/(dashboard)/payroll-lab/arrangements/actions'

export type ArrangementCatalogueQuery = {
  q?: string
  kind?: string
  status?: string
  sort?: string
  package?: string
}

const STRATEGY_TRANSLATION_KEYS = {
  DISCRETE_SCALE_STEP: 'arrangementsStrategy_DISCRETE_SCALE_STEP',
  OPEN_SALARY_BAND: 'arrangementsStrategy_OPEN_SALARY_BAND',
  FREELY_NEGOTIATED: 'arrangementsStrategy_FREELY_NEGOTIATED',
} as const

const PACKAGE_NAME_KEYS: Readonly<Record<string, string>> = {
  KINDEROPVANG_2025_2026: 'arrangementsNameKinderopvang',
  RETAIL_NON_FOOD_MODE_2026_2027: 'arrangementsNameRetailMode',
  LHR_DEMO_OPEN_BANDS_2026: 'arrangementsNameOpenSalaryBands',
}

const PACKAGE_SELECTION_KEYS: Readonly<Record<string, string>> = {
  KINDEROPVANG_2025_2026: 'kinderopvang',
  RETAIL_NON_FOOD_MODE_2026_2027: 'retail-mode',
  LHR_DEMO_OPEN_BANDS_2026: 'open-salary-bands',
}

function arrangementName(definition: ArrangementPackage, t: Translator): string {
  const key = PACKAGE_NAME_KEYS[definition.id]
  return key ? t(key) : definition.displayName
}

function currentVersion(definition: ArrangementPackage, today: string): ArrangementPackageVersion | null {
  return definition.versions.find((version) => version.effectiveFrom <= today
    && (version.effectiveTo === null || today <= version.effectiveTo)) ?? null
}

function availabilityState(item: ArrangementFoundationPageData['packages'][number], today: string): 'missing' | 'available' | 'scheduled' | 'expired' {
  if (!item.availability) return 'missing'
  if (item.available) return 'available'
  if (item.availability.effective_from > today) return 'scheduled'
  if (item.availability.effective_to && item.availability.effective_to < today) return 'expired'
  return 'missing'
}

function hrefWithSelection(query: ArrangementCatalogueQuery, packageId: string): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.kind) params.set('kind', query.kind)
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  params.set('package', PACKAGE_SELECTION_KEYS[packageId] ?? 'arrangement')
  return `/payroll-lab/arrangements?${params.toString()}`
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export function ArrangementCatalogue({
  data,
  query,
  t,
}: {
  data: ArrangementFoundationPageData
  query: ArrangementCatalogueQuery
  t: Translator
}) {
  const normalizedSearch = query.q?.trim().toLocaleLowerCase() ?? ''
  const kind = query.kind === 'COLLECTIVE_AGREEMENT' || query.kind === 'COMPANY_POLICY' ? query.kind : 'all'
  const status = query.status === 'available' || query.status === 'unavailable' ? query.status : 'all'
  const sort = ['name', 'kind', 'version', 'status'].includes(query.sort ?? '') ? query.sort! : 'name'

  const filtered = data.packages.filter((item) => {
    if (kind !== 'all' && item.definition.kind !== kind) return false
    if (status === 'available' && !item.available) return false
    if (status === 'unavailable' && item.available) return false
    if (!normalizedSearch) return true
    const version = currentVersion(item.definition, data.today)?.version ?? ''
    return `${arrangementName(item.definition, t)} ${version}`.toLocaleLowerCase().includes(normalizedSearch)
  })

  filtered.sort((left, right) => {
    const leftVersion = currentVersion(left.definition, data.today)?.version ?? ''
    const rightVersion = currentVersion(right.definition, data.today)?.version ?? ''
    const leftState = availabilityState(left, data.today)
    const rightState = availabilityState(right, data.today)
    if (sort === 'kind') return compareText(t(left.definition.kind === 'COLLECTIVE_AGREEMENT' ? 'arrangementsCollectiveAgreement' : 'arrangementsCompanyPolicy'), t(right.definition.kind === 'COLLECTIVE_AGREEMENT' ? 'arrangementsCollectiveAgreement' : 'arrangementsCompanyPolicy')) || compareText(arrangementName(left.definition, t), arrangementName(right.definition, t))
    if (sort === 'version') return compareText(rightVersion, leftVersion) || compareText(arrangementName(left.definition, t), arrangementName(right.definition, t))
    if (sort === 'status') return compareText(leftState, rightState) || compareText(arrangementName(left.definition, t), arrangementName(right.definition, t))
    return compareText(arrangementName(left.definition, t), arrangementName(right.definition, t))
  })

  const selected = filtered.find((item) => PACKAGE_SELECTION_KEYS[item.definition.id] === query.package) ?? filtered[0] ?? null
  const packagesToActivate = data.packages.filter((item) => item.availability === null)
  const hasUnassignedAvailability = packagesToActivate.length > 0

  return <div className="space-y-5">
    <PageToolbar
      start={<div>
        <SectionHeader title={t('arrangementsPackagesTitle')} description={t('arrangementsPackagesDescription')} />
      </div>}
    />

    {hasUnassignedAvailability ? <Surface className="border border-info-border bg-info-surface p-4 sm:p-5">
      <details>
        <summary className="cursor-pointer font-semibold text-foreground">{t('arrangementsAdminActionTitle')}</summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <p className="text-sm text-foreground">{t('arrangementsAdminActionScope', { administration: data.administrationName })}</p>
            <p className="text-sm text-foreground">{t('arrangementsAdminActionPackages', { names: packagesToActivate.map((item) => arrangementName(item.definition, t)).join(', ') })}</p>
            <p className="text-sm text-muted-foreground">{t('arrangementsAdminActionPermission')}</p>
          </div>
          {data.canWrite ? <form action={makeArrangementPackagesAvailableAction} className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            <label className="grid w-full gap-1 text-sm sm:max-w-48"><span>{t('arrangementsAvailabilityFrom')}</span><TextInput defaultValue={data.today} name="effectiveFrom" required type="date" /></label>
            <label className="grid w-full gap-1 text-sm sm:max-w-48"><span>{t('arrangementsAvailabilityThrough')}</span><TextInput name="effectiveTo" type="date" /></label>
            <Button type="submit">{t('arrangementsMakeAvailableAction')}</Button>
          </form> : <p className="text-sm text-muted-foreground">{t('arrangementsAdminPermissionRequired')}</p>}
        </div>
      </details>
    </Surface> : null}

    <Surface className="space-y-4 p-4 sm:p-5">
      <form action="/payroll-lab/arrangements" className="space-y-3" method="get">
        <FilterBar actions={<div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary">{t('arrangementsApplyFilters')}</Button>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href="/payroll-lab/arrangements">{t('arrangementsClearFilters')}</Link>
        </div>}>
          <label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
            <span>{t('arrangementsSearchLabel')}</span>
            <TextInput autoComplete="off" defaultValue={query.q ?? ''} name="q" placeholder={t('arrangementsSearchPlaceholder')} />
          </label>
          <label className="grid min-w-[10rem] gap-1 text-sm">
            <span id="arrangements-type-filter-label">{t('arrangementsTypeFilter')}</span>
            <DropdownSelect aria-labelledby="arrangements-type-filter-label" defaultValue={kind} name="kind">
              <option value="all">{t('arrangementsFilterAllTypes')}</option>
              <option value="COLLECTIVE_AGREEMENT">{t('arrangementsCollectiveAgreement')}</option>
              <option value="COMPANY_POLICY">{t('arrangementsCompanyPolicy')}</option>
            </DropdownSelect>
          </label>
          <label className="grid min-w-[11rem] gap-1 text-sm">
            <span id="arrangements-status-filter-label">{t('arrangementsStatusFilter')}</span>
            <DropdownSelect aria-labelledby="arrangements-status-filter-label" defaultValue={status} name="status">
              <option value="all">{t('arrangementsFilterAllStatuses')}</option>
              <option value="available">{t('arrangementsAvailable')}</option>
              <option value="unavailable">{t('arrangementsNotAvailable')}</option>
            </DropdownSelect>
          </label>
          <label className="grid min-w-[10rem] gap-1 text-sm">
            <span id="arrangements-sort-filter-label">{t('arrangementsSortLabel')}</span>
            <DropdownSelect aria-labelledby="arrangements-sort-filter-label" defaultValue={sort} name="sort">
              <option value="name">{t('arrangementsSortName')}</option>
              <option value="kind">{t('arrangementsSortKind')}</option>
              <option value="version">{t('arrangementsSortVersion')}</option>
              <option value="status">{t('arrangementsSortStatus')}</option>
            </DropdownSelect>
          </label>
        </FilterBar>
      </form>

      <p className="text-xs text-muted-foreground">{t('arrangementsAsOfDate', { date: data.today })}</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section aria-label={t('arrangementsPackagesTitle')} className="min-w-0">
          <div className="mb-2 hidden grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.8fr)] gap-3 border-b border-border-subtle px-3 py-2 text-xs font-semibold text-muted-foreground sm:grid">
            <span>{t('arrangementsColumnArrangement')}</span><span>{t('arrangementsColumnCurrentVersion')}</span>
          </div>
          {filtered.length ? <ul className="divide-y divide-border-subtle">
            {filtered.map((item) => {
              const selectedVersion = currentVersion(item.definition, data.today)
              const selectedRow = selected?.definition.id === item.definition.id
              const state = availabilityState(item, data.today)
              return <li key={item.definition.id}>
                <Link
                  aria-current={selectedRow ? 'true' : undefined}
                  className={`block rounded-[var(--radius-control)] px-3 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${selectedRow ? 'bg-surface-subtle' : 'hover:bg-surface-subtle/70'}`}
                  href={hrefWithSelection(query, item.definition.id)}
                >
                  <span className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.8fr)] sm:gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{arrangementName(item.definition, t)}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{t(item.definition.kind === 'COLLECTIVE_AGREEMENT' ? 'arrangementsCollectiveAgreement' : 'arrangementsCompanyPolicy')}</span>
                    </span>
                    <span className="text-sm sm:text-right">
                      <span className="block text-xs font-medium text-muted-foreground sm:hidden">{t('arrangementsColumnCurrentVersion')}</span>
                      {selectedVersion ? <><span className="font-semibold tabular-nums text-foreground">{selectedVersion.version}</span><span className="ml-2 text-muted-foreground">{selectedVersion.effectiveFrom} — {selectedVersion.effectiveTo ?? t('arrangementsOpenEnded')}</span></> : <span className="text-muted-foreground">{t('arrangementsNoCurrentVersion')}</span>}
                    </span>
                  </span>
                  <span className="mt-3 grid gap-2 border-t border-border-subtle pt-2 text-xs sm:grid-cols-3 sm:gap-3">
                    <span className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-muted-foreground">{t('arrangementsCatalogueState')}</span><Badge tone="neutral">{t('arrangementsInCatalogue')}</Badge></span>
                    <span className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-muted-foreground">{t('arrangementsAdministrationState')}</span><Badge tone={state === 'available' ? 'success' : 'warning'}>{t(state === 'available' ? 'arrangementsAvailable' : state === 'scheduled' ? 'arrangementsAvailabilityScheduled' : state === 'expired' ? 'arrangementsAvailabilityExpired' : 'arrangementsNotAvailable')}</Badge>{item.availability ? <span className="tabular-nums text-muted-foreground">{item.availability.effective_from} — {item.availability.effective_to ?? t('arrangementsOpenEnded')}</span> : null}</span>
                    <span className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-muted-foreground">{t('arrangementsCalculationState')}</span><Badge tone="warning">{t('arrangementsCalculationNotValidated')}</Badge></span>
                  </span>
                </Link>
              </li>
            })}
          </ul> : <EmptyState description={t('arrangementsNoResultsDescription')} icon={<FileSearch />} title={t('arrangementsNoResultsTitle')} />}
        </section>

        {selected ? <ArrangementDetails data={data} item={selected} t={t} /> : <Surface className="p-5"><p className="text-sm text-muted-foreground">{t('arrangementsNoSelection')}</p></Surface>}
      </div>
    </Surface>
  </div>
}

function ArrangementDetails({
  data,
  item,
  t,
}: {
  data: ArrangementFoundationPageData
  item: ArrangementFoundationPageData['packages'][number]
  t: Translator
}) {
  const definition = item.definition
  const state = availabilityState(item, data.today)
  const earliestPackageDate = definition.versions.map((version) => version.effectiveFrom).sort()[0]
  const limitedReference = (status: string) => status === 'SYNTHETIC_POLICY'

  return <aside aria-labelledby="arrangement-detail-heading" className="min-w-0">
    <Surface className="space-y-4 p-4 sm:p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold" id="arrangement-detail-heading">{arrangementName(definition, t)}</h2>
          <Badge tone={state === 'available' ? 'success' : 'warning'}>{t(state === 'available' ? 'arrangementsAvailable' : state === 'scheduled' ? 'arrangementsAvailabilityScheduled' : state === 'expired' ? 'arrangementsAvailabilityExpired' : 'arrangementsNotAvailable')}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t(definition.kind === 'COLLECTIVE_AGREEMENT' ? 'arrangementsCollectiveAgreement' : 'arrangementsCompanyPolicy')}</p>
      </div>

      <dl className="space-y-3 border-y border-border-subtle py-3 text-sm">
        <div><dt className="font-medium">{t('arrangementsCatalogueState')}</dt><dd className="mt-0.5 text-muted-foreground">{t('arrangementsInCatalogue')}</dd></div>
        <div><dt className="font-medium">{t('arrangementsAdministrationState')}</dt><dd className="mt-0.5 text-muted-foreground">{state === 'missing' ? t('arrangementsNoAvailabilityRecord') : `${t(state === 'available' ? 'arrangementsAvailable' : state === 'scheduled' ? 'arrangementsAvailabilityScheduled' : 'arrangementsAvailabilityExpired')}: ${item.availability!.effective_from} — ${item.availability!.effective_to ?? t('arrangementsOpenEnded')}`}</dd></div>
        <div><dt className="font-medium">{t('arrangementsCalculationState')}</dt><dd className="mt-0.5 text-muted-foreground">{t('arrangementsCalculationNotValidated')}</dd></div>
      </dl>

      {data.canWrite && state === 'available' && item.availability && earliestPackageDate && item.availability.effective_from > earliestPackageDate ? <form action={extendArrangementPackageAvailabilityStartAction} className="space-y-2 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
        <input name="packageId" type="hidden" value={definition.id} />
        <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityFrom')}</span><TextInput defaultValue={item.availability.effective_from} max={item.availability.effective_to ?? data.today} min={earliestPackageDate} name="effectiveFrom" required type="date" /></label>
        <Button type="submit" variant="secondary">{t('arrangementsExtendAvailabilityStart')}</Button>
      </form> : null}

      {data.canWrite && item.availability?.effective_to === null ? <form action={endArrangementPackageAvailabilityAction} className="space-y-2 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
        <input name="packageId" type="hidden" value={definition.id} />
        <label className="grid gap-1 text-sm"><span>{t('arrangementsAvailabilityLastDate')}</span><TextInput defaultValue={data.today} min={item.availability.effective_from} name="effectiveTo" required type="date" /></label>
        <Button type="submit" variant="secondary">{t('arrangementsEndAvailability')}</Button>
      </form> : null}
      {!data.canWrite && item.availability ? <p className="text-xs text-muted-foreground">{t('arrangementsAdminPermissionRequired')}</p> : null}

      <section aria-labelledby="arrangement-version-history-heading" className="space-y-2">
        <h3 className="font-semibold" id="arrangement-version-history-heading">{t('arrangementsVersionHistory')}</h3>
        <ol className="space-y-3">
          {[...definition.versions].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom)).map((version) => <li className="border-l-2 border-border-subtle pl-3" key={version.version}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <h4 className="text-sm font-semibold">{t('arrangementsVersion')} {version.version}</h4>
              {currentVersion(definition, data.today)?.version === version.version ? <Badge tone="info">{t('arrangementsCurrentVersion')}</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{version.effectiveFrom} — {version.effectiveTo ?? t('arrangementsOpenEnded')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('arrangementsSupportedStrategies')}: {version.supportedSalaryStrategies.map((strategy) => t(STRATEGY_TRANSLATION_KEYS[strategy])).join(', ')}</p>
            <div className="mt-2 space-y-1 rounded-[var(--radius-control)] bg-surface-subtle p-3 text-xs">
              <p className="font-medium">{t('arrangementsSourceInformation')}</p>
              <a className="break-words text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus" href={version.sourceMetadata.sourceUrl} rel="noreferrer" target="_blank">{limitedReference(version.sourceMetadata.status) ? t('arrangementsLimitedSourceTitle') : version.sourceMetadata.sourceTitle}</a>
              <p className="text-muted-foreground">{t('arrangementsSourceRecordedOn')}: {version.sourceMetadata.recordedOn}</p>
              <p className="text-muted-foreground">{limitedReference(version.sourceMetadata.status) ? t('arrangementsLimitedSourceStatus') : t('arrangementsReferenceOnly')}</p>
              <p className="text-muted-foreground">{t(limitedReference(version.sourceMetadata.status) ? 'arrangementsLimitedSourceNote' : 'arrangementsReferenceNote')}</p>
            </div>
          </li>)}
        </ol>
      </section>

    </Surface>
  </aside>
}
