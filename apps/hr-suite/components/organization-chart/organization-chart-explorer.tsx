'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Building2, Filter, Network, Search, ShieldCheck, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageToolbar } from '@/components/patterns/page-toolbar'
import { ScrollableTabs, TabLink } from '@/components/patterns/scrollable-tabs'
import type { OrganizationChartGraph } from '@/lib/organization-chart/types'
import { OrganizationChartCanvas } from './organization-chart-canvas'
import { OrganizationChartMobileTree } from './organization-chart-mobile-tree'
import type { OrganizationChartLabels } from './organization-chart-nodes'

export interface OrganizationChartExplorerLabels extends OrganizationChartLabels {
  viewLabel: string
  viewDepartment: string
  viewManager: string
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
  previousTab: string
  nextTab: string
  manageDepartments: string
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const department = graph.filters.departments.find((item) => item.id === query.department)
  const role = graph.filters.roles.find((item) => item.code === query.role)
  const field = graph.filters.customFields.find((item) => item.id === query.field)
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

  function viewHref(nextView: 'department' | 'manager'): string {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => { if (value) params.set(key, value) })
    params.set('view', nextView)
    return `/organization-chart?${params.toString()}`
  }

  function persistFilter(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget)
    const filter = Object.fromEntries(['view', 'date', 'q', 'department', 'role', 'field', 'value'].map((key) => [key, String(form.get(key) ?? '')]))
    void fetch('/api/preferences/organization-chart', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(filter) })
  }

  return (
    <>
      <section className="space-y-4">
        <PageToolbar
          end={<p aria-live="polite" className="text-sm font-semibold text-muted-foreground">{matchText}</p>}
          start={<ScrollableTabs ariaLabel={labels.viewLabel} leftLabel={labels.previousTab} rightLabel={labels.nextTab}><TabLink active={query.view === 'department'} href={viewHref('department')}>{labels.viewDepartment}</TabLink><TabLink active={query.view === 'manager'} href={viewHref('manager')}>{labels.viewManager}</TabLink></ScrollableTabs>}
        />
        <form action="/organization-chart" className="space-y-3" method="get" onSubmit={persistFilter}>
          <input name="view" type="hidden" value={query.view === 'job' ? 'department' : query.view} />
          <FilterBar actions={<><button className={buttonClasses({ size: 'sm', variant: 'secondary' })} onClick={() => setFiltersOpen((value) => !value)} type="button"><Filter aria-hidden="true" size={15} />{filtersOpen ? labels.lessFilters : labels.moreFilters}</button><button className={buttonClasses({ size: 'sm' })} type="submit"><Search aria-hidden="true" size={15} />{labels.searchAction}</button></>}>
            <label className="min-w-[min(100%,20rem)] flex-1"><span className="sr-only">{labels.searchLabel}</span><TextInput defaultValue={query.q} key={query.q} leadingIcon={<Search aria-hidden="true" />} name="q" placeholder={labels.searchPlaceholder} type="search" /></label>
            {filtersOpen ? <>
              <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.departmentLabel}</span><DropdownSelect aria-label={labels.departmentLabel} name="department" onChange={(event) => setDepartmentId(event.target.value)} placeholder={labels.allDepartments} searchable searchPlaceholder={labels.searchDepartment} value={departmentId}><option value="">{labels.allDepartments}</option>{graph.filters.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></label>
              <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.roleLabel}</span><DropdownSelect aria-label={labels.roleLabel} name="role" onChange={(event) => setRoleCode(event.target.value)} placeholder={labels.allRoles} searchable searchPlaceholder={labels.searchRole} value={roleCode}><option value="">{labels.allRoles}</option>{graph.filters.roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</DropdownSelect></label>
              <label className="grid min-w-40 gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.dateLabel}</span><TextInput defaultValue={query.date} name="date" type="date" /></label>
              <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.customFieldLabel}</span><DropdownSelect aria-label={labels.customFieldLabel} name="field" onChange={(event) => { setFieldId(event.target.value); setFieldValue('') }} placeholder={labels.noCustomField} searchable searchPlaceholder={labels.customFieldLabel} value={fieldId}><option value="">{labels.noCustomField}</option>{graph.filters.customFields.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</DropdownSelect></label>
              <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.customFieldValueLabel}</span><TextInput aria-describedby="custom-field-hint" disabled={!fieldId} name="value" onChange={(event) => setFieldValue(event.target.value)} placeholder={fieldId ? labels.customFieldValuePlaceholder : labels.customFieldValueDisabled} required={Boolean(fieldId)} value={fieldValue} /></label>
              {!fieldId ? <p className="basis-full text-xs font-normal text-muted-foreground" id="custom-field-hint">{labels.customFieldValueDisabled}</p> : null}
            </> : null}
          </FilterBar>

          {(graph.filters.departments.length > 0 || graph.filters.roles.length > 0) && filtersOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{labels.quickFilters}</span>
              {graph.filters.departments.slice(0, 3).map((item) => <button aria-pressed={departmentId === item.id} className={`inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus ${departmentId === item.id ? 'border-accent-foreground/30 bg-accent text-accent-foreground' : 'bg-surface text-muted-foreground hover:bg-muted'}`} key={item.id} onClick={() => setDepartmentId(departmentId === item.id ? '' : item.id)} type="button"><Building2 aria-hidden="true" size={12} />{item.name}</button>)}
              {graph.filters.roles.slice(0, 2).map((item) => <button aria-pressed={roleCode === item.code} className={`inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus ${roleCode === item.code ? 'border-accent-foreground/30 bg-accent text-accent-foreground' : 'bg-surface text-muted-foreground hover:bg-muted'}`} key={item.code} onClick={() => setRoleCode(roleCode === item.code ? '' : item.code)} type="button"><ShieldCheck aria-hidden="true" size={12} />{item.name}</button>)}
            </div>
          ) : null}

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
