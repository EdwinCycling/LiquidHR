import Link from 'next/link'
import { ArrowLeft, Blocks, Copy, Pencil, Plus, Search } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ComponentLibraryEntryDetail, payrollComponentCategory, payrollComponentName, payrollComponentStatus } from '@/components/payroll/component-library-entry-detail'
import { ComponentEditor } from '@/components/payroll/component-editor'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
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
}

type Filters = {
  q: string
  category: string
  ownership: 'all' | 'system' | 'customer'
  status: 'all' | 'packaged' | 'draft'
}

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

function entryCategoryKey(entry: ComponentCatalogEntry): string {
  return entry.category?.trim() || entry.definition.method.kind
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
    ].filter((value): value is string => Boolean(value)).some((value) => value.toLocaleLowerCase(locale).includes(query))
  })
}

function libraryHref(filters: Filters, component?: string): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.ownership !== 'all') params.set('ownership', filters.ownership)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (component) params.set('component', component)
  const search = params.toString()
  return search ? `/payroll-components?${search}` : '/payroll-components'
}

function ComponentList({
  entries,
  filters,
  selectedKey,
  locale,
  t,
}: {
  entries: readonly ComponentCatalogEntry[]
  filters: Filters
  selectedKey: string
  locale: string
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  return <Surface className="overflow-hidden">
    <ul className="divide-y divide-border-subtle" aria-label={t('payrollComponents')}>
      {entries.map((entry) => {
        const selected = entry.key === selectedKey
        const status = payrollComponentStatus(entry)
        return <li key={entry.key}>
          <Link aria-current={selected ? 'page' : undefined} className={`block min-w-0 px-4 py-4 transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus sm:px-5 ${selected ? 'bg-surface-subtle' : ''}`.trim()} href={libraryHref(filters, entry.key)}>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-foreground">{payrollComponentName(entry, t)}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{entry.displayCode && entry.displayCode !== entry.definition.code ? `${entry.displayCode} · ` : ''}{entry.definition.code} · v{entry.definition.version}</p>
                <p className="mt-2 text-xs text-muted-foreground">{entry.description?.trim() || t('payrollComponentsDescriptionUnavailable')}</p>
                <p className="mt-2 break-words text-xs text-muted-foreground">{payrollComponentCategory(entry, t)} · {t(`payrollComponentsScope_${entry.definition.processingScope}`)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Badge tone={entry.ownership === 'SYSTEM' ? 'info' : 'neutral'}>{t(`payrollComponentsOwnership_${entry.ownership}`)}</Badge>
                <Badge tone={status === 'DRAFT' ? 'warning' : 'neutral'}>{t(`payrollComponentsStatus_${status}`)}</Badge>
                {!entry.validation.valid ? <Badge tone="warning">{t('payrollComponentsValidationWarning')}</Badge> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{t('payrollComponentsEffectiveFrom')}: {formatDate(entry.definition.effectiveFrom, locale)}</span>
              <span>{t('payrollComponentsEffectiveTo')}: {formatDate(entry.definition.effectiveTo, locale)}</span>
              <span>{t(entry.ownership === 'CUSTOMER_FORK' ? 'payrollComponentsSourcePackage' : 'payrollComponentsPackage')}: {entry.package.version ?? entry.package.compositionId}</span>
            </div>
          </Link>
        </li>
      })}
    </ul>
  </Surface>
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function ComponentFilters({
  entries,
  filters,
  selectedKey,
  locale,
  t,
}: {
  entries: readonly ComponentCatalogEntry[]
  filters: Filters
  selectedKey: string
  locale: string
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  const categories = [...new Set(entries.map(entryCategoryKey))].sort((left, right) => left.localeCompare(right, locale))
  return <FilterBar className="flex-col items-stretch sm:flex-row sm:items-end">
    <form action="/payroll-components" className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" key={JSON.stringify(filters)} method="get">
      {selectedKey ? <input name="component" type="hidden" value={selectedKey} /> : null}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{t('payrollComponentsSearchAction')}</Button>
        <Link className={buttonClasses({ variant: 'secondary' })} href={libraryHref({ q: '', category: '', ownership: 'all', status: 'all' }, selectedKey || undefined)}>{t('payrollComponentsClearFilters')}</Link>
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
      return <PageShell className="space-y-6 py-6 sm:py-8" width="standard" role="status">
        <PageHeader actions={<Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>} description={t('payrollComponentsUnavailable')} title={t('payrollComponents')} />
        <EmptyState description={t('payrollComponentsLoadError')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsUnavailable')} />
      </PageShell>
    }
    return <PageShell className="space-y-6 py-6 sm:py-8" width="standard" role="status">
      <PageHeader actions={<Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>} description={t('payrollComponentsLoadError')} title={t('payrollComponents')} />
      <EmptyState description={t('payrollComponentsLoadError')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsUnavailable')} />
    </PageShell>
  }

  const filters = currentFilters(query)
  const selectedKey = queryValue(query.component)
  const selected = library.components.find((entry) => entry.key === selectedKey) ?? null
  const newRequested = queryValue(query.new) === '1'
  const editRequested = queryValue(query.edit) === '1'
  const selectedIsDraft = Boolean(selected && selected.status === 'DRAFT' && selected.ownership !== 'SYSTEM')
  const selectedVersions = selectedIsDraft
    ? library.components.filter((entry) => entry.definition.code === selected!.definition.code && entry.status === 'DRAFT')
    : []
  const latestSelected = selectedVersions.reduce<ComponentCatalogEntry | null>((latest, entry) => {
    if (!latest) return entry
    return Number(entry.definition.version) > Number(latest.definition.version) ? entry : latest
  }, null)
  const canEditSelected = Boolean(selectedIsDraft && latestSelected?.key === selected?.key)
  const editDraft = Boolean(editRequested && selectedIsDraft && selected)
  const showEditor = newRequested || editDraft
  const filtered = filterEntries(library.components, filters, locale, t).sort((left, right) =>
    payrollComponentName(left, t).localeCompare(payrollComponentName(right, t), locale)
      || left.definition.code.localeCompare(right.definition.code, locale)
      || left.definition.version.localeCompare(right.definition.version, locale))
  const saved = queryValue(query.saved) === '1'
  const copied = queryValue(query.copied) === '1'
  const error = queryValue(query.error)
  const errorMessage = error === 'copy-not-allowed'
    ? t('payrollComponentsCopyUnavailable')
    : error === 'copy-failed'
      ? t('payrollComponentsCopyError')
      : null
  const list = filtered.length
    ? <ComponentList entries={filtered} filters={filters} locale={locale} selectedKey={selectedKey} t={t} />
    : <EmptyState description={t('payrollComponentsNoResultsDescription')} icon={<Search aria-hidden="true" />} title={t('payrollComponentsNoResults')} />
  const selectedPanel = selected
    ? <ComponentLibraryEntryDetail components={library.components} entry={selected} locale={locale} t={t} />
    : selectedKey
      ? <EmptyState description={t('payrollComponentsNotFound')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsNotFound')} />
      : <EmptyState description={t('payrollComponentsNoSelection')} icon={<Blocks aria-hidden="true" />} title={t('payrollComponentsDetail')} />
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
      <Link className={buttonClasses({ variant: 'secondary' })} href={selected ? libraryHref(filters, selected.key) : libraryHref(filters)}>{t('payrollComponentsEditorCancel')}</Link>
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

  return <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
    <PageHeader actions={<div className="flex flex-wrap gap-2">
      {library.canCopy ? <Link className={buttonClasses({ variant: 'primary' })} href="/payroll-components?new=1"><Plus aria-hidden="true" />{t('payrollComponentsNew')}</Link> : null}
      <Link className={buttonClasses({ variant: 'secondary' })} href="/payroll-lab"><ArrowLeft aria-hidden="true" />{t('payrollLabBackToOverview')}</Link>
    </div>} description={t('payrollComponentsDescription')} title={t('payrollComponents')} />
    {copied ? <Surface className="border-success bg-success-surface p-3 text-sm text-success" role="status">{t('payrollComponentsCopied')}</Surface> : null}
    {saved ? <Surface className="border-success bg-success-surface p-3 text-sm text-success" role="status">{t('payrollComponentsEditorSaved')}</Surface> : null}
    {errorMessage ? <Surface className="border-destructive/40 p-3 text-sm text-destructive" role="alert">{errorMessage}</Surface> : null}
    <ComponentFilters entries={library.components} filters={filters} locale={locale} selectedKey={selectedKey} t={t} />
    {showEditor ? <DetailColumns className="items-start" main={editorPanel} aside={<div className="space-y-3">
      <SectionHeader title={t('payrollComponentsResultCount', { count: filtered.length })} />
      {list}
      {selected ? <ComponentLibraryEntryDetail components={library.components} entry={selected} locale={locale} t={t} /> : null}
    </div>} /> : selected ? <DetailColumns className="items-start" main={<div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="break-words text-xl font-semibold text-foreground">{payrollComponentName(selected, t)}</h2></div>
        <div className="flex flex-wrap gap-2">
          {selectedIsDraft && canEditSelected ? <Link className={buttonClasses({ variant: 'secondary' })} href={`${libraryHref(filters, selected.key)}&edit=1`}><Pencil aria-hidden="true" />{t('payrollComponentsEdit')}</Link> : null}
          <CopyAction canCopy={library.canCopy} entry={selected} t={t} />
        </div>
      </div>
      <ComponentLibraryEntryDetail components={library.components} entry={selected} locale={locale} t={t} />
    </div>} aside={<div className="space-y-3">
      <SectionHeader title={t('payrollComponentsResultCount', { count: filtered.length })} />
      {list}
    </div>} /> : <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <section className="min-w-0">
        <SectionHeader title={t('payrollComponentsResultCount', { count: filtered.length })} />
        <div className="mt-3">{list}</div>
      </section>
      <aside className="min-w-0">{selectedPanel}</aside>
    </div>}
  </PageShell>
}
