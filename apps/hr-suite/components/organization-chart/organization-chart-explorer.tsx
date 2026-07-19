'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Building2, CalendarDays, Check, ChevronDown, Filter, Network, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import type { OrganizationChartGraph } from '@/lib/organization-chart/types'
import { OrganizationChartCanvas } from './organization-chart-canvas'
import { OrganizationChartMobileTree } from './organization-chart-mobile-tree'
import type { OrganizationChartLabels } from './organization-chart-nodes'

export interface OrganizationChartExplorerLabels extends OrganizationChartLabels {
  viewLabel: string
  viewDepartment: string
  viewManager: string
  viewJob: string
  primaryCountDepartment: string
  primaryCountManager: string
  primaryCountJob: string
  exploreTitle: string
  exploreSubtitle: string
  searchLabel: string
  searchPlaceholder: string
  searchAction: string
  departmentLabel: string
  allDepartments: string
  roleLabel: string
  allRoles: string
  searchDepartment: string
  searchRole: string
  noFilterOptions: string
  quickFilters: string
  moreFilters: string
  lessFilters: string
  dateLabel: string
  customFieldLabel: string
  noCustomField: string
  customFieldValueLabel: string
  customFieldValuePlaceholder: string
  customFieldValueDisabled: string
  applyFilters: string
  activeFilters: string
  queryChip: string
  departmentChip: string
  roleChip: string
  fieldChip: string
  dateChip: string
  removeFilter: string
  resetAll: string
  matchCount: string
  matchCountOne: string
  noMatchesTitle: string
  noMatchesBody: string
  emptyTitle: string
  emptyBody: string
  canvasLabel: string
  mobileTreeLabel: string
  expandBranch: string
  zoomIn: string
  zoomOut: string
  fitView: string
  legendRoute: string
  legendMatch: string
  legendContext: string
}

export interface OrganizationChartExplorerQuery {
  view: 'department' | 'manager' | 'job'
  date: string
  q?: string
  department?: string
  role?: string
  field?: string
  value?: string
}

interface ActiveChip { key: keyof OrganizationChartExplorerQuery | 'customField'; label: string }
interface SearchableOption { value: string; label: string; keywords: string }
interface OrganizationChartExplorerProps {
  graph: OrganizationChartGraph
  query: OrganizationChartExplorerQuery
  labels: OrganizationChartExplorerLabels
  defaultDate: string
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, key: string) => {
    const value = values[key]
    return value === undefined ? placeholder : String(value)
  })
}

function queryHref(query: OrganizationChartExplorerQuery, remove: ActiveChip['key']): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  if (remove === 'customField') {
    params.delete('field')
    params.delete('value')
  } else {
    params.delete(remove)
  }
  const serialized = params.toString()
  return serialized ? `/organization-chart?${serialized}` : '/organization-chart'
}

function SearchableFilter({ name, value, options, allLabel, searchLabel, emptyLabel, onChange }: {
  name: string
  value: string
  options: readonly SearchableOption[]
  allLabel: string
  searchLabel: string
  emptyLabel: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = useState('')
  const details = useRef<HTMLDetailsElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)
  const normalized = search.trim().toLocaleLowerCase()
  const visibleOptions = normalized
    ? options.filter((option) => `${option.label} ${option.keywords}`.toLocaleLowerCase().includes(normalized)).slice(0, 50)
    : options.slice(0, 50)

  function select(nextValue: string) {
    onChange(nextValue)
    setSearch('')
    if (details.current) details.current.open = false
  }

  return (
    <div className="relative min-w-0">
      <input name={name} type="hidden" value={value} />
      <details className="group" ref={details}>
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border bg-surface-raised px-4 text-sm font-medium text-foreground outline-none transition-shadow focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 [&::-webkit-details-marker]:hidden">
          <span className="truncate">{selected?.label ?? allLabel}</span>
          <ChevronDown aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" size={17} />
        </summary>
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 rounded-2xl border bg-surface p-2 shadow-xl">
          <label className="relative block">
            <span className="sr-only">{searchLabel}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input aria-controls={listId} className="h-10 w-full rounded-xl border bg-surface-raised pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-focus focus:ring-2 focus:ring-focus/20" onChange={(event) => setSearch(event.target.value)} placeholder={searchLabel} type="search" value={search} />
          </label>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto" id={listId} role="listbox">
            <button aria-selected={!value} className="flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:bg-accent focus-visible:text-accent-foreground" onClick={() => select('')} role="option" type="button">{allLabel}{!value ? <Check aria-hidden="true" size={15} /> : null}</button>
            {visibleOptions.map((option) => (
              <button aria-selected={option.value === value} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-accent focus-visible:text-accent-foreground" key={option.value} onClick={() => select(option.value)} role="option" type="button">
                <span className="truncate">{option.label}</span>{option.value === value ? <Check aria-hidden="true" className="shrink-0 text-accent-foreground" size={15} /> : null}
              </button>
            ))}
            {visibleOptions.length === 0 ? <p className="px-3 py-5 text-center text-xs text-muted-foreground">{emptyLabel}</p> : null}
          </div>
        </div>
      </details>
    </div>
  )
}

export function OrganizationChartExplorer(props: OrganizationChartExplorerProps) {
  const { query } = props
  const stateKey = [query.view, query.date, query.q, query.department, query.role, query.field, query.value].join('|')
  return <OrganizationChartExplorerState {...props} key={stateKey} />
}

function OrganizationChartExplorerState({ graph, query, labels, defaultDate }: OrganizationChartExplorerProps) {
  const [departmentId, setDepartmentId] = useState(query.department ?? '')
  const [roleCode, setRoleCode] = useState(query.role ?? '')
  const [fieldId, setFieldId] = useState(query.field ?? '')
  const [fieldValue, setFieldValue] = useState(query.value ?? '')
  const [view, setView] = useState(query.view)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const department = graph.filters.departments.find((item) => item.id === query.department)
  const role = graph.filters.roles.find((item) => item.code === query.role)
  const field = graph.filters.customFields.find((item) => item.id === query.field)
  const departmentOptions = graph.filters.departments.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}`, keywords: `${item.code} ${item.name}` }))
  const roleOptions = graph.filters.roles.map((item) => ({ value: item.code, label: item.name, keywords: `${item.code} ${item.name}` }))
  const chips: ActiveChip[] = [
    ...(query.q ? [{ key: 'q' as const, label: interpolate(labels.queryChip, { value: query.q }) }] : []),
    ...(department ? [{ key: 'department' as const, label: interpolate(labels.departmentChip, { value: department.name }) }] : []),
    ...(role ? [{ key: 'role' as const, label: interpolate(labels.roleChip, { value: role.name }) }] : []),
    ...(field && query.value ? [{ key: 'customField' as const, label: interpolate(labels.fieldChip, { field: field.label, value: query.value }) }] : []),
    ...(query.date !== defaultDate ? [{ key: 'date' as const, label: interpolate(labels.dateChip, { value: query.date }) }] : []),
  ]
  const hasStructure = graph.metadata.visiblePrimaryCount > 0 || graph.metadata.visibleEmployeeCount > 0
  const hasFiltering = chips.length > 0
  const matchText = graph.metadata.matchCount === 1 ? labels.matchCountOne : interpolate(labels.matchCount, { count: graph.metadata.matchCount })

  function persistFilter(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget)
    const filter = Object.fromEntries(['view', 'date', 'q', 'department', 'role', 'field', 'value'].map((key) => [key, String(form.get(key) ?? '')]))
    void fetch('/api/preferences/organization-chart', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(filter) })
  }

  return (
    <>
      <section className="relative z-20 overflow-visible rounded-3xl border bg-surface shadow-[0_18px_55px_-38px_var(--primary)]">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-accent-foreground" />
        <div aria-hidden="true" className="pointer-events-none absolute right-6 top-5 hidden size-20 rounded-full border border-accent-foreground/10 sm:block" />
        <div aria-hidden="true" className="pointer-events-none absolute right-11 top-10 hidden size-10 rounded-full border border-accent-foreground/15 sm:block" />
        <form action="/organization-chart" className="relative p-5 sm:p-6" method="get" onSubmit={persistFilter}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><SlidersHorizontal aria-hidden="true" className="text-accent-foreground" size={17} />{labels.exploreTitle}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.exploreSubtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="button-secondary inline-flex h-9 items-center gap-2 px-3 text-xs" onClick={() => setFiltersOpen((value) => !value)}><Filter aria-hidden="true" size={14} />{filtersOpen ? labels.lessFilters : labels.moreFilters}</button>
              <p aria-live="polite" className="inline-flex min-h-8 items-center rounded-xl border border-accent-foreground/15 bg-accent px-3 text-xs font-semibold text-accent-foreground">{matchText}</p>
            </div>
          </div>

          <div className="mt-4 max-w-sm">
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              <span>{labels.viewLabel}</span>
              <select className="form-field h-11" name="view" onChange={(event) => setView(event.target.value as typeof view)} value={view}>
                <option value="department">{labels.viewDepartment}</option>
                <option value="manager">{labels.viewManager}</option>
                <option value="job">{labels.viewJob}</option>
              </select>
            </label>
          </div>

          {filtersOpen ? <>
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(20rem,1fr)_15rem_15rem_auto]">
            <label className="relative block">
              <span className="sr-only">{labels.searchLabel}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent-foreground" size={19} />
              <input className="h-12 w-full rounded-2xl border bg-surface-raised pl-11 pr-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-focus focus:ring-2 focus:ring-focus/20" defaultValue={query.q} key={query.q} name="q" placeholder={labels.searchPlaceholder} type="search" />
            </label>
            <SearchableFilter allLabel={labels.allDepartments} emptyLabel={labels.noFilterOptions} name="department" onChange={setDepartmentId} options={departmentOptions} searchLabel={labels.searchDepartment} value={departmentId} />
            <SearchableFilter allLabel={labels.allRoles} emptyLabel={labels.noFilterOptions} name="role" onChange={setRoleCode} options={roleOptions} searchLabel={labels.searchRole} value={roleCode} />
            <button className="button-primary inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5" type="submit"><Search aria-hidden="true" size={17} />{labels.searchAction}</button>
          </div>

          {(graph.filters.departments.length > 0 || graph.filters.roles.length > 0) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-l-2 border-accent-foreground/30 pl-3">
              <span className="mr-1 text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{labels.quickFilters}</span>
              {graph.filters.departments.slice(0, 3).map((item) => <button aria-pressed={departmentId === item.id} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus ${departmentId === item.id ? 'border-accent-foreground/30 bg-accent text-accent-foreground' : 'bg-surface text-muted-foreground hover:bg-muted'}`} key={item.id} onClick={() => setDepartmentId(departmentId === item.id ? '' : item.id)} type="button"><Building2 aria-hidden="true" size={12} />{item.name}</button>)}
              {graph.filters.roles.slice(0, 2).map((item) => <button aria-pressed={roleCode === item.code} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus ${roleCode === item.code ? 'border-accent-foreground/30 bg-accent text-accent-foreground' : 'bg-surface text-muted-foreground hover:bg-muted'}`} key={item.code} onClick={() => setRoleCode(roleCode === item.code ? '' : item.code)} type="button"><ShieldCheck aria-hidden="true" size={12} />{item.name}</button>)}
            </div>
          ) : null}

          <details className="group mt-4 rounded-2xl border bg-surface-raised">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><Filter aria-hidden="true" className="text-accent-foreground" size={16} /><span className="group-open:hidden">{labels.moreFilters}</span><span className="hidden group-open:inline">{labels.lessFilters}</span></span>
              <ChevronDown aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180" size={17} />
            </summary>
            <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-[14rem_1fr_1fr_auto] lg:items-end">
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground"><span>{labels.dateLabel}</span><span className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={15} /><input className="form-field h-11 pl-9" defaultValue={query.date} name="date" type="date" /></span></label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground"><span>{labels.customFieldLabel}</span><select className="form-field h-11" name="field" onChange={(event) => { setFieldId(event.target.value); setFieldValue('') }} value={fieldId}><option value="">{labels.noCustomField}</option>{graph.filters.customFields.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground"><span>{labels.customFieldValueLabel}</span><input aria-describedby="custom-field-hint" className="form-field h-11 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" disabled={!fieldId} name="value" onChange={(event) => setFieldValue(event.target.value)} placeholder={fieldId ? labels.customFieldValuePlaceholder : labels.customFieldValueDisabled} required={Boolean(fieldId)} value={fieldValue} /></label>
              <button className="button-secondary h-11 px-4" type="submit">{labels.applyFilters}</button>
              {!fieldId ? <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4" id="custom-field-hint">{labels.customFieldValueDisabled}</p> : null}
            </div>
          </details>
          </> : null}

          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{labels.activeFilters}</span>
              {chips.map((chip) => (
                <Link aria-label={interpolate(labels.removeFilter, { filter: chip.label })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent-foreground/20 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground outline-none transition-colors hover:border-accent-foreground/40 focus-visible:ring-2 focus-visible:ring-focus" href={queryHref(query, chip.key)} key={chip.key}>
                  {chip.label}<X aria-hidden="true" size={13} />
                </Link>
              ))}
              <Link className="ml-auto min-h-9 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus" href="/organization-chart">{labels.resetAll}</Link>
            </div>
          ) : null}
        </form>
      </section>

      {!hasStructure ? (
        <section className="mt-6 grid min-h-80 place-items-center rounded-3xl border bg-surface p-8 text-center">
          <div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><Network aria-hidden="true" size={24} /></span><h2 className="mt-4 text-lg font-semibold text-foreground">{labels.emptyTitle}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.emptyBody}</p></div>
        </section>
      ) : (
        <div className="mt-6">
          {hasFiltering && graph.metadata.matchCount === 0 ? <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-warning">{labels.noMatchesTitle}</h2><p className="mt-0.5 text-xs leading-5 text-warning">{labels.noMatchesBody}</p></div><Link className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-focus" href="/organization-chart">{labels.resetAll}</Link></div> : null}
          <OrganizationChartCanvas graph={graph} labels={labels} />
          <OrganizationChartMobileTree graph={graph} labels={labels} />
        </div>
      )}
    </>
  )
}
