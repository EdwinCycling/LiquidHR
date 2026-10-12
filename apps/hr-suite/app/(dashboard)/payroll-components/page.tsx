import Link from 'next/link'
import { ArrowLeft, Blocks, Copy, Pencil, Plus, Search } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ComponentLibraryEntryDetail, payrollComponentCategory, payrollComponentName, payrollComponentStatus } from '@/components/payroll/component-library-entry-detail'
import { ComponentEditor } from '@/components/payroll/component-editor'
import { PageShell } from '@/components/layout/page-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getComponentLibrary } from '@/lib/payroll/component-library'
import { PayrollLabUnavailableError } from '@/lib/payroll/access'
import type { ComponentCatalogEntry } from '@/lib/payroll/component-catalog'
import { componentEditorStateFromEntry, newComponentEditorState } from '@/lib/payroll/component-editor-state'
import { copySystemComponentAction } from './actions'

type ComponentLibraryQuery = {
  q?: string | string[]
  category?: string | string[]
  ownership?: string | string[]
  status?: string | string[]
  component?: string | string[]
  saved?: string | string[]
  copied?: string | string[]
  edit?: string | string[]
  new?: string | string[]
  error?: string | string[]
  sort?: string | string[]
  page?: string | string[]
}

type Filters = {
  q: string
  category: string
  ownership: 'all' | 'system' | 'customer'
  status: 'all' | 'packaged' | 'draft'
}

type ComponentSort = 'name' | 'code' | 'category'
type ComponentGroup = {
  identity: string
  entry: ComponentCatalogEntry
  versionCount: number
}

const PAGE_SIZE = 25

const EDITOR_LABEL_KEYS = [
  'payrollComponentsEditorActionFailed', 'payrollComponentsEditorAddDependency', 'payrollComponentsEditorAddInput',
  'payrollComponentsEditorAddOutput', 'payrollComponentsEditorAddParameter', 'payrollComponentsEditorAggregateInputs',
  'payrollComponentsEditorAggregateOperation', 'payrollComponentsEditorCalculation', 'payrollComponentsEditorCalculationContext',
  'payrollComponentsEditorCalculationMethod', 'payrollComponentsEditorTracePolicy_FULL', 'payrollComponentsEditorTracePolicy_OUTPUTS',
  'payrollComponentsEditorTracePolicy_NONE', 'payrollComponentsEditorStatus', 'payrollComponentsEditorCalculated', 'payrollComponentsEditorBlocked',
  'payrollComponentsEditorCategory', 'payrollComponentsEditorCode', 'payrollComponentsEditorCodeHelp',
  'payrollComponentsEditorComponentOutput', 'payrollComponentsEditorControls', 'payrollComponentsEditorDecimalPlaces',
  'payrollComponentsEditorDependencies', 'payrollComponentsEditorDescription', 'payrollComponentsEditorEffectiveFrom',
  'payrollComponentsEditorEffectiveTo', 'payrollComponentsEditorFormula', 'payrollComponentsEditorFormulaHelp',
  'payrollComponentsEditorGeneral', 'payrollComponentsEditorInputName', 'payrollComponentsEditorInputs',
  'payrollComponentsEditorMethod', 'payrollComponentsEditorName', 'payrollComponentsEditorNoDependencies',
  'payrollComponentsEditorNoInputs', 'payrollComponentsEditorNoParameters', 'payrollComponentsEditorNoPreviewInputs',
  'payrollComponentsEditorOutputName', 'payrollComponentsEditorOutputs', 'payrollComponentsEditorOwnership',
  'payrollComponentsEditorParameterName', 'payrollComponentsEditorParameters', 'payrollComponentsEditorParameterValue',
  'payrollComponentsEditorPreviewInput', 'payrollComponentsEditorPreviewInputHelp', 'payrollComponentsEditorPreviewInputs',
  'payrollComponentsEditorProvenance', 'payrollComponentsEditorReadOnly', 'payrollComponentsEditorRemove',
  'payrollComponentsEditorRequired', 'payrollComponentsEditorResult', 'payrollComponentsEditorRounding',
  'payrollComponentsEditorRoundingMode', 'payrollComponentsEditorRunPreview', 'payrollComponentsEditorSaveDraft',
  'payrollComponentsEditorSaveFailed', 'payrollComponentsEditorScope', 'payrollComponentsEditorSelectInput',
  'payrollComponentsEditorSourceMethod', 'payrollComponentsEditorSourceMethodReadOnly', 'payrollComponentsEditorTrace',
  'payrollComponentsEditorTracePolicy', 'payrollComponentsEditorUseRounding', 'payrollComponentsEditorValidate',
  'payrollComponentsEditorValueType', 'payrollComponentsEditorValueTypeHelp', 'payrollComponentsMethod_aggregate',
  'payrollComponentsMethod_expression', 'payrollComponentsMethod_passThrough', 'payrollComponentsMethod_source',
  'payrollComponentsScope_EMPLOYMENT', 'payrollComponentsScope_PAYROLL_RUN',
  'payrollComponentsScope_INCOME_RELATIONSHIP', 'payrollComponentsScope_ASSESSMENT_BASE_GROUP', 'payrollComponentsScope_EMPLOYEE',
  'payrollComponentsScope_PAYROLL_PERIOD', 'payrollComponentsScope_EMPLOYER', 'payrollComponentsValueType_MONEY',
  'payrollComponentsValueType_DECIMAL', 'payrollComponentsValueType_PERCENTAGE', 'payrollComponentsValueType_BOOLEAN',
  'payrollComponentsValueType_STRING', 'payrollComponentsEditorWritePermissionRequired', 'payrollComponentsEditorIssueDate',
  'payrollComponentsEditorIssueStaleVersion', 'payrollComponentsEditorIssueDependency', 'payrollComponentsEditorIssueCycle',
  'payrollComponentsEditorIssueDivisionByZero', 'payrollComponentsEditorIssueRounding', 'payrollComponentsEditorIssueType',
  'payrollComponentsEditorIssueFormula', 'payrollComponentsEditorIssueCodeDuplicate', 'payrollComponentsEditorIssueGeneric',
] as const

function queryValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

function currentFilters(query: ComponentLibraryQuery): Filters {
  const ownership = queryValue(query.ownership)
  const status = queryValue(query.status)
  return {
    q: queryValue(query.q).trim(),
    category: queryValue(query.category),
    ownership: ownership === 'system' || ownership === 'customer' ? ownership : 'all',
    status: status === 'packaged' || status === 'draft' ? status : 'all',
  }
}

function currentSort(query: ComponentLibraryQuery): ComponentSort {
  const sort = queryValue(query.sort)
  return sort === 'code' || sort === 'category' ? sort : 'name'
}

function currentPage(query: ComponentLibraryQuery): number {
  const page = Number(queryValue(query.page))
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function entryCategoryKey(entry: ComponentCatalogEntry): string {
  return entry.category?.trim() || entry.definition.method.kind
}

function componentIdentityKey(entry: ComponentCatalogEntry): string {
  return JSON.stringify([entry.ownership, entry.package.compositionId, entry.definition.id])
}

function groupEntries(entries: readonly ComponentCatalogEntry[]): ComponentGroup[] {
  const groups = new Map<string, ComponentCatalogEntry[]>()
  for (const entry of entries) {
    const identity = componentIdentityKey(entry)
    const versions = groups.get(identity) ?? []
    versions.push(entry)
    groups.set(identity, versions)
  }
  return [...groups].map(([identity, versions]) => {
    versions.sort((left, right) => right.definition.version.localeCompare(left.definition.version, undefined, { numeric: true, sensitivity: 'base' }))
    return { identity, entry: versions[0], versionCount: versions.length }
  })
}

function compareGroups(left: ComponentGroup, right: ComponentGroup, sort: ComponentSort, locale: string, t: (key: string) => string): number {
  const leftEntry = left.entry
  const rightEntry = right.entry
  const primary = sort === 'code'
    ? leftEntry.definition.code.localeCompare(rightEntry.definition.code, locale)
    : sort === 'category'
      ? payrollComponentCategory(leftEntry, t).localeCompare(payrollComponentCategory(rightEntry, t), locale)
      : payrollComponentName(leftEntry, t).localeCompare(payrollComponentName(rightEntry, t), locale)
  return primary
    || payrollComponentName(leftEntry, t).localeCompare(payrollComponentName(rightEntry, t), locale)
    || leftEntry.definition.code.localeCompare(rightEntry.definition.code, locale)
    || left.identity.localeCompare(right.identity, locale)
}

function searchableMetadataValues(value: unknown): string[] {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(searchableMetadataValues)
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [key, ...searchableMetadataValues(item)])
  }
  return []
}

function filterEntries(entries: readonly ComponentCatalogEntry[], filters: Filters, locale: string, t: (key: string) => string): ComponentCatalogEntry[] {
  const query = filters.q.toLocaleLowerCase(locale)
  return entries.filter((entry) => {
    if (filters.category && entryCategoryKey(entry) !== filters.category) return false
    if (filters.ownership === 'system' && entry.ownership !== 'SYSTEM') return false
    if (filters.ownership === 'customer' && entry.ownership === 'SYSTEM') return false
    if (filters.status !== 'all' && payrollComponentStatus(entry).toLocaleLowerCase() !== filters.status) return false
    if (!query) return true
    return [
      payrollComponentName(entry, t),
      entry.definition.code,
      entry.displayCode,
      entry.description,
      entry.definition.version,
      entry.definition.method.kind,
      entryCategoryKey(entry),
      entry.definition.ownership.kind === 'CUSTOMER_FORK' ? entry.definition.ownership.origin.code : undefined,
      entry.package.compositionId,
      entry.package.packageId,
      entry.package.version,
      ...searchableMetadataValues(entry.package),
      ...searchableMetadataValues(entry.sourceMetadata),
      ...searchableMetadataValues(entry.parameterMetadata),
      ...searchableMetadataValues(entry.parameters),
      ...searchableMetadataValues(entry.definition.ownership),
      ...searchableMetadataValues(entry.dependencies),
      ...searchableMetadataValues(entry.roundingDefinitions),
    ].filter((value): value is string => Boolean(value)).some((value) => value.toLocaleLowerCase(locale).includes(query))
  })
}

function libraryHref(filters: Filters, component?: string, sort: ComponentSort = 'name', page = 1): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.ownership !== 'all') params.set('ownership', filters.ownership)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (sort !== 'name') params.set('sort', sort)
  if (page > 1) params.set('page', String(page))
  if (component) params.set('component', component)
  const search = params.toString()
  return search ? `/payroll-components?${search}` : '/payroll-components'
}

function hrefWithParam(href: string, key: string, value: string): string {
  const [path, search = ''] = href.split('?')
  const params = new URLSearchParams(search)
  params.set(key, value)
  return `${path}?${params.toString()}`
}

function ComponentList({
  groups,
  filters,
  sort,
  page,
  totalPages,
  resultCount,
  totalCount,
  activeFilters,
  t,
}: {
  groups: readonly ComponentGroup[]
  filters: Filters
  sort: ComponentSort
  page: number
  totalPages: number
  resultCount: number
  totalCount: number
  activeFilters: readonly string[]
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  return <div className="space-y-4">
    <div aria-live="polite" className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-sm" role="status">
      <p className="font-medium text-foreground">{t('payrollComponentsResultCount', { count: resultCount })}</p>
      <p className="text-muted-foreground">{t('payrollComponentsAccessibleCount', { count: totalCount })}</p>
    </div>
    {activeFilters.length ? <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label={t('payrollComponentsActiveFilters')} role="group">
      <span className="text-xs font-medium text-muted-foreground">{t('payrollComponentsActiveFilters')}:</span>
      {activeFilters.map((filter) => <Badge key={filter} tone="neutral">{filter}</Badge>)}
    </div> : null}
    {groups.length ? <Surface className="overflow-hidden">
    <table aria-label={t('payrollComponents')} className="w-full table-fixed text-left text-sm">
      <thead className="sr-only bg-surface-subtle text-xs text-muted-foreground md:not-sr-only md:table-header-group">
        <tr>
          <th className="w-[44%] px-4 py-3 font-medium">{t('payrollComponents')}</th>
          <th className="w-[20%] px-4 py-3 font-medium">{t('payrollComponentsCategory')}</th>
          <th className="w-[22%] px-4 py-3 font-medium">{t('payrollComponentsOwnership')} / {t('payrollComponentsStatus')}</th>
          <th className="w-[14%] px-4 py-3 font-medium">{t('payrollComponentsVersion')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
      {groups.map(({ entry, versionCount }) => {
        const status = payrollComponentStatus(entry)
        return <tr className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-subtle md:table-row md:px-0 md:py-0" key={entry.key}>
          <td className="col-span-2 min-w-0 py-1 md:table-cell md:px-4 md:py-3">
            <Link className="block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-focus" href={libraryHref(filters, entry.key, sort, page)}>
              <span className="block break-words font-semibold text-foreground">{payrollComponentName(entry, t)}</span>
              <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{entry.displayCode && entry.displayCode !== entry.definition.code ? `${entry.displayCode} · ` : ''}{entry.definition.code} · v{entry.definition.version}</span>
              {entry.description?.trim() ? <span className="mt-1 block break-words text-xs text-muted-foreground">{entry.description}</span> : null}
            </Link>
          </td>
          <td className="min-w-0 py-1 md:table-cell md:px-4 md:py-3">
            <span className="mb-1 block text-xs text-muted-foreground md:hidden">{t('payrollComponentsCategory')}</span>
            <span className="break-words text-sm">{payrollComponentCategory(entry, t)}</span>
          </td>
          <td className="min-w-0 py-1 md:table-cell md:px-4 md:py-3">
            <span className="mb-1 block text-xs text-muted-foreground md:hidden">{t('payrollComponentsOwnership')} / {t('payrollComponentsStatus')}</span>
            <span className="flex min-w-0 flex-wrap gap-1.5">
              <Badge tone={entry.ownership === 'SYSTEM' ? 'info' : 'neutral'}>{t(`payrollComponentsOwnership_${entry.ownership}`)}</Badge>
              <Badge tone={status === 'DRAFT' ? 'warning' : 'neutral'}>{t(`payrollComponentsStatus_${status}`)}</Badge>
              {!entry.validation.valid ? <Badge tone="warning">{t('payrollComponentsValidationWarning')}</Badge> : null}
            </span>
          </td>
          <td className="min-w-0 py-1 md:table-cell md:px-4 md:py-3">
            <span className="mb-1 block text-xs text-muted-foreground md:hidden">{t('payrollComponentsVersion')}</span>
            <span className="block break-words font-mono text-xs">v{entry.definition.version}</span>
            {versionCount > 1 ? <span className="mt-1 block text-xs text-muted-foreground">{t('payrollComponentsVersionCount', { count: versionCount })}</span> : null}
          </td>
        </tr>
      })}
      </tbody>
    </table>
    </Surface> : <EmptyState description={t('payrollComponentsNoResultsDescription')} icon={<Search aria-hidden="true" />} title={t('payrollComponentsNoResults')} />}
    {resultCount ? <nav aria-label={t('payrollComponentsPagination')} className="flex min-w-0 flex-wrap items-center justify-between gap-3" aria-live="polite">
      {page > 1
        ? <Link className={buttonClasses({ variant: 'secondary' })} href={libraryHref(filters, undefined, sort, page - 1)}>{t('payrollComponentsPreviousPage')}</Link>
        : <Button disabled type="button">{t('payrollComponentsPreviousPage')}</Button>}
      <p className="text-sm text-muted-foreground">{t('payrollComponentsPageStatus', { page, total: totalPages })}</p>
      {page < totalPages
        ? <Link className={buttonClasses({ variant: 'secondary' })} href={libraryHref(filters, undefined, sort, page + 1)}>{t('payrollComponentsNextPage')}</Link>
        : <Button disabled type="button">{t('payrollComponentsNextPage')}</Button>}
    </nav> : null}
  </div>
}

function ComponentFilters({
  entries,
  filters,
  sort,
  locale,
  t,
}: {
  entries: readonly ComponentCatalogEntry[]
  filters: Filters
  sort: ComponentSort
  locale: string
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  const categories = [...new Set(entries.map(entryCategoryKey))].sort((left, right) => left.localeCompare(right, locale))
  return <FilterBar className="flex-col items-stretch sm:flex-row sm:items-end">
    <form action="/payroll-components" className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" key={JSON.stringify([filters, sort])} method="get">
      <FormField className="min-w-48 flex-1" control={<TextInput defaultValue={filters.q} leadingIcon={<Search aria-hidden="true" />} name="q" placeholder={t('payrollComponentsSearchPlaceholder')} type="search" />} label={t('payrollComponentsSearch')} />
      <FormField className="min-w-40 flex-1" control={<DropdownSelect defaultValue={filters.category} emptyLabel={t('payrollComponentsNoResults')} name="category" placeholder={t('payrollComponentsFilterAll')} searchable searchPlaceholder={t('payrollComponentsSearchPlaceholder')}>
        <option value="">{t('payrollComponentsFilterAll')}</option>
        {categories.map((category) => {
          const sample = entries.find((entry) => entryCategoryKey(entry) === category)
          const label = sample ? payrollComponentCategory(sample, t) : category
          return <option key={category} value={category}>{label}</option>
        })}
      </DropdownSelect>} label={t('payrollComponentsCategory')} />
      <FormField className="min-w-40 flex-1" control={<DropdownSelect defaultValue={filters.ownership} name="ownership">
        <option value="all">{t('payrollComponentsFilterAll')}</option>
        <option value="system">{t('payrollComponentsFilterSystem')}</option>
        <option value="customer">{t('payrollComponentsFilterCustomer')}</option>
      </DropdownSelect>} label={t('payrollComponentsOwnership')} />
      <FormField className="min-w-40 flex-1" control={<DropdownSelect defaultValue={filters.status} name="status">
        <option value="all">{t('payrollComponentsFilterAll')}</option>
        <option value="packaged">{t('payrollComponentsFilterPackaged')}</option>
        <option value="draft">{t('payrollComponentsFilterDraft')}</option>
      </DropdownSelect>} label={t('payrollComponentsStatus')} />
      <FormField className="min-w-40 flex-1" control={<DropdownSelect defaultValue={sort} name="sort">
        <option value="name">{t('payrollComponentsSortName')}</option>
        <option value="code">{t('payrollComponentsSortCode')}</option>
        <option value="category">{t('payrollComponentsSortCategory')}</option>
      </DropdownSelect>} label={t('payrollComponentsSort')} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{t('payrollComponentsSearchAction')}</Button>
        <Link className={buttonClasses({ variant: 'secondary' })} href={libraryHref({ q: '', category: '', ownership: 'all', status: 'all' }, undefined, sort)}>{t('payrollComponentsClearFilters')}</Link>
      </div>
    </form>
  </FilterBar>
}

function CopyAction({
  entry,
  canCopy,
  t,
}: {
  entry: ComponentCatalogEntry
  canCopy: boolean
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  if (entry.ownership !== 'SYSTEM') return null
  const reason = !entry.forkable
    ? entry.forkBlockReason === 'REGISTERED_RULE_NOT_COPYABLE' ? t('payrollComponentsCopyBlockedRegisteredRule') : t('payrollComponentsCopyUnavailable')
    : !canCopy ? t('payrollComponentsCopyRequiresWrite') : null
  return <div className="flex flex-col items-start gap-2">
    <form action={copySystemComponentAction}>
      <input name="catalogKey" type="hidden" value={entry.key} />
      <Button aria-describedby={reason ? 'payroll-component-copy-reason' : undefined} disabled={Boolean(reason)} type="submit"><Copy aria-hidden="true" />{t('payrollComponentsCopyAndEdit')}</Button>
    </form>
    {reason ? <p className="max-w-prose text-xs text-muted-foreground" id="payroll-component-copy-reason">{reason}</p> : null}
  </div>
}

export default async function PayrollComponentsPage({
  searchParams,
}: {
  searchParams: Promise<ComponentLibraryQuery>
}) {
  const [t, locale, query] = await Promise.all([
    getTranslator('navigation'),
    getLocale(),
    searchParams,
  ])
  let library: Awaited<ReturnType<typeof getComponentLibrary>>
  try {
    library = await getComponentLibrary()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    if (error instanceof PayrollLabUnavailableError) {
      return <PageShell className="space-y-6 py-6 sm:py-8" width="wide" role="status">
        <PageHeader actions={<Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>} description={t('payrollComponentsUnavailable')} title={t('payrollComponents')} />
        <EmptyState description={t('payrollComponentsLoadError')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsUnavailable')} />
      </PageShell>
    }
    return <PageShell className="space-y-6 py-6 sm:py-8" width="wide" role="status">
      <PageHeader actions={<Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>} description={t('payrollComponentsLoadError')} title={t('payrollComponents')} />
      <EmptyState description={t('payrollComponentsLoadError')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsUnavailable')} />
    </PageShell>
  }

  const filters = currentFilters(query)
  const sort = currentSort(query)
  const selectedKey = queryValue(query.component)
  const selected = library.components.find((entry) => entry.key === selectedKey) ?? null
  const newRequested = queryValue(query.new) === '1'
  const editRequested = queryValue(query.edit) === '1'
  const selectedIsDraft = Boolean(selected && selected.status === 'DRAFT' && selected.ownership !== 'SYSTEM')
  const selectedVersions = selectedIsDraft
    ? library.components.filter((entry) => componentIdentityKey(entry) === componentIdentityKey(selected!) && entry.status === 'DRAFT')
    : []
  const latestSelected = groupEntries(selectedVersions)[0]?.entry ?? null
  const canEditSelected = Boolean(selectedIsDraft && latestSelected?.key === selected?.key)
  const editDraft = Boolean(editRequested && selectedIsDraft && selected)
  const showEditor = newRequested || editDraft
  const allGroups = groupEntries(library.components)
  const matchingGroups = groupEntries(filterEntries(library.components, filters, locale, t))
  const allGroupByIdentity = new Map(allGroups.map((group) => [group.identity, group]))
  const filteredGroups = matchingGroups.map((group) => ({
    ...group,
    versionCount: allGroupByIdentity.get(group.identity)?.versionCount ?? group.versionCount,
  })).sort((left, right) => compareGroups(left, right, sort, locale, t))
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const page = Math.min(currentPage(query), totalPages)
  const pageGroups = filteredGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const saved = queryValue(query.saved) === '1'
  const copied = queryValue(query.copied) === '1'
  const error = queryValue(query.error)
  const errorMessage = error === 'copy-not-allowed'
    ? t('payrollComponentsCopyUnavailable')
    : error === 'copy-failed'
      ? t('payrollComponentsCopyError')
      : null
  const selectedCategory = filters.category
    ? library.components.find((entry) => entryCategoryKey(entry) === filters.category)
    : undefined
  const activeFilters = [
    ...(filters.q ? [`${t('payrollComponentsSearch')}: ${filters.q}`] : []),
    ...(filters.category ? [`${t('payrollComponentsCategory')}: ${selectedCategory ? payrollComponentCategory(selectedCategory, t) : filters.category}`] : []),
    ...(filters.ownership !== 'all' ? [`${t('payrollComponentsOwnership')}: ${t(filters.ownership === 'system' ? 'payrollComponentsFilterSystem' : 'payrollComponentsFilterCustomer')}`] : []),
    ...(filters.status !== 'all' ? [`${t('payrollComponentsStatus')}: ${t(filters.status === 'draft' ? 'payrollComponentsFilterDraft' : 'payrollComponentsFilterPackaged')}`] : []),
  ]
  const overviewHref = libraryHref(filters, undefined, sort, page)
  const selectedHref = selected ? libraryHref(filters, selected.key, sort, page) : overviewHref
  const packageOptions = library.packageOptions ?? []
  const initial = editDraft && selected
    ? componentEditorStateFromEntry(selected, selected.key.slice('draft::'.length), payrollComponentName(selected, t), entryCategoryKey(selected))
    : newComponentEditorState(packageOptions[0]?.compositionId ?? '', new Date().toISOString().slice(0, 10), t('payrollComponentsEditorNewName'), t('payrollComponentsEditorDefaultCategory'))
  const dependencyOptions = library.components.filter((entry) => entry.ownership === 'SYSTEM')
    .flatMap((entry) => entry.definition.outputs.map((output) => ({
      componentCode: entry.definition.code,
      outputName: output.name,
      valueType: output.valueType,
      label: `${payrollComponentName(entry, t)} · ${entry.definition.code}.${output.name} · ${output.valueType}`,
    })))
  const editorLabels = Object.fromEntries(EDITOR_LABEL_KEYS.map((key) => [key, t(key)]))
  const sourcePath = editDraft && selected?.definition.method.kind === 'source' ? selected.definition.method.path.join('.') : undefined
  const provenanceLabel = editDraft && selected?.definition.ownership.kind === 'CUSTOMER_FORK'
    ? `${selected.definition.ownership.origin.code} v${selected.definition.ownership.origin.version}`
    : editDraft ? t('payrollComponentsEditorCustomerCustom') : ''
  const editorPanel = <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{editDraft && selected ? payrollComponentName(selected, t) : t('payrollComponentsNew')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('payrollComponentsEditorDraftNotice')}</p>
      </div>
      <Link className={buttonClasses({ variant: 'secondary' })} href={selected ? selectedHref : overviewHref}><ArrowLeft aria-hidden="true" />{selected ? t('payrollComponentsBackToDetails') : t('payrollComponentsBackToLibrary')}</Link>
    </div>
    {selectedIsDraft && !canEditSelected ? <Surface className="border-warning bg-warning-surface p-3 text-sm text-foreground" role="status">{t('payrollComponentsEditorOlderVersionReadOnly')}</Surface> : null}
    {!library.canCopy ? <Surface className="border-warning bg-warning-surface p-3 text-sm text-foreground" role="status">{t('payrollComponentsEditorWritePermissionRequired')}</Surface> : null}
    <ComponentEditor
      key={editDraft && selected ? selected.key : 'new-component'}
      canSave={library.canCopy && (newRequested ? packageOptions.length > 0 : canEditSelected)}
      dependencyOptions={dependencyOptions}
      initial={initial}
      labels={editorLabels}
      ownershipLabel={editDraft && selected ? t(`payrollComponentsOwnership_${selected.ownership}`) : t('payrollComponentsEditorCustomerCustom')}
      packageOptions={packageOptions}
      provenanceLabel={provenanceLabel}
      readOnly={!library.canCopy || (editDraft && !canEditSelected)}
      sourcePath={sourcePath}
    />
  </div>

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader actions={<div className="flex flex-wrap gap-2">
      {library.canCopy && !showEditor ? <Link className={buttonClasses({ variant: 'primary' })} href={hrefWithParam(overviewHref, 'new', '1')}><Plus aria-hidden="true" />{t('payrollComponentsNew')}</Link> : null}
      <Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>
    </div>} description={t('payrollComponentsDescription')} title={t('payrollComponents')} />
    {copied ? <Surface className="border-success bg-success-surface p-3 text-sm text-success" role="status">{t('payrollComponentsCopied')}</Surface> : null}
    {saved ? <Surface className="border-success bg-success-surface p-3 text-sm text-success" role="status">{t('payrollComponentsEditorSaved')}</Surface> : null}
    {errorMessage ? <Surface className="border-destructive/40 p-3 text-sm text-destructive" role="alert">{errorMessage}</Surface> : null}
    {showEditor ? editorPanel : selected ? <div className="space-y-4">
      <Link className={`${buttonClasses({ variant: 'secondary' })} w-fit`} href={overviewHref}><ArrowLeft aria-hidden="true" />{t('payrollComponentsBackToLibrary')}</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="break-words text-xl font-semibold text-foreground">{payrollComponentName(selected, t)}</h2></div>
        <div className="flex flex-wrap gap-2">
          {selectedIsDraft && canEditSelected ? <Link className={buttonClasses({ variant: 'secondary' })} href={hrefWithParam(selectedHref, 'edit', '1')}><Pencil aria-hidden="true" />{t('payrollComponentsEdit')}</Link> : null}
          <CopyAction canCopy={library.canCopy} entry={selected} t={t} />
        </div>
      </div>
      <ComponentLibraryEntryDetail components={library.components} entry={selected} entryHref={(key) => libraryHref(filters, key, sort, page)} locale={locale} t={t} />
    </div> : selectedKey ? <div className="space-y-4">
      <Link className={`${buttonClasses({ variant: 'secondary' })} w-fit`} href={overviewHref}><ArrowLeft aria-hidden="true" />{t('payrollComponentsBackToLibrary')}</Link>
      <EmptyState description={t('payrollComponentsNotFound')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsNotFound')} />
    </div> : <div className="space-y-4">
      <ComponentFilters entries={library.components} filters={filters} sort={sort} locale={locale} t={t} />
      <ComponentList activeFilters={activeFilters} filters={filters} groups={pageGroups} page={page} resultCount={filteredGroups.length} sort={sort} t={t} totalCount={allGroups.length} totalPages={totalPages} />
    </div>}
  </PageShell>
}
