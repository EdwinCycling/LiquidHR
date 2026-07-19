'use client'

import Link from 'next/link'
import { ArrowUpDown, Filter, LayoutList, Search, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { employeeListHref, type EmployeeArchiveFilter, type EmployeeListSort, type EmployeeListView, type EmployeeStatusFilter } from '@/lib/preferences/employee-list-state'

interface EmployeeStatusOption {
  value: EmploymentStatus
  label: string
}

interface EmployeeArchiveOption {
  value: 'active' | 'archived' | 'all'
  label: string
}

interface EmployeeFilterPanelLabels {
  all: string
  employeeNumber: string
  searchPlaceholder: string
  searchAction: string
  clearSearch: string
  statusFilter: string
  archiveFilter: string
  sortLabel: string
  sortFirstName: string
  sortLastName: string
  showFilters: string
  hideFilters: string
  clearFilters: string
  viewLabel: string
  viewCompact: string
  viewDetail: string
}

interface EmployeeFilterPanelProps {
  search: string
  activeStatus: EmployeeStatusFilter
  archiveFilter: EmployeeArchiveFilter
  sort: EmployeeListSort
  view: EmployeeListView
  statusOptions: EmployeeStatusOption[]
  archiveOptions: EmployeeArchiveOption[]
  labels: EmployeeFilterPanelLabels
  resultCountLabel: string
  initialOpen: boolean
}

export function EmployeeFilterPanel({
  search,
  activeStatus,
  archiveFilter,
  sort,
  view,
  statusOptions,
  archiveOptions,
  labels,
  resultCountLabel,
  initialOpen,
}: EmployeeFilterPanelProps) {
  const router = useRouter()
  const [filtersOpen, setFiltersOpen] = useState(initialOpen)
  const [searchInput, setSearchInput] = useState(search)
  const hasActiveFilters = search.trim().length > 0 || activeStatus !== 'ACTIVE_EMPLOYEE' || archiveFilter !== 'active' || sort !== 'last-name' || view !== 'detail'

  async function savePreferences(next: { status: EmployeeStatusFilter; archive: EmployeeArchiveFilter; sort: EmployeeListSort; view: EmployeeListView }): Promise<void> {
    await fetch('/api/preferences/employees', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => undefined)
  }

  async function navigate(next: { search: string; status: EmployeeStatusFilter; archive: EmployeeArchiveFilter; sort: EmployeeListSort; view: EmployeeListView }): Promise<void> {
    await savePreferences(next)
    router.push(employeeListHref(next))
  }

  function toggleFilters() {
    setFiltersOpen((current) => {
      const next = !current
      void fetch('/api/preferences/employees', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filterPanelOpen: next }) }).catch(() => undefined)
      return next
    })
  }

  return (
    <div className="mt-7 rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-expanded={filtersOpen}
            className="button-secondary inline-flex min-h-10 items-center gap-2 px-3"
            onClick={toggleFilters}
            type="button"
          >
            <Filter aria-hidden="true" className="h-4 w-4" />
            {filtersOpen ? labels.hideFilters : labels.showFilters}
          </button>
          {hasActiveFilters ? (
            <Link
              className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={employeeListHref({ search: '', status: 'ACTIVE_EMPLOYEE', archive: 'active', sort: 'last-name', view: 'detail' })}
              onClick={(event) => {
                event.preventDefault()
                void navigate({ search: '', status: 'ACTIVE_EMPLOYEE', archive: 'active', sort: 'last-name', view: 'detail' })
              }}
            >
              {labels.clearFilters}
            </Link>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
          <UsersRound aria-hidden="true" className="h-4 w-4" />
          {resultCountLabel}
        </span>
      </div>

      {filtersOpen ? (
        <>
          <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center">
            <div className="rounded-xl border bg-background/80 p-3.5">
              <form className="flex w-full items-center gap-2" method="get" onSubmit={(event) => {
                event.preventDefault()
                void navigate({ search: searchInput, status: activeStatus, archive: archiveFilter, sort, view })
              }}>
                {activeStatus !== 'ACTIVE_EMPLOYEE' ? <input name="status" type="hidden" value={activeStatus} /> : null}
                {archiveFilter !== 'active' ? <input name="archive" type="hidden" value={archiveFilter} /> : null}
                {sort !== 'last-name' ? <input name="sort" type="hidden" value={sort} /> : null}
                {view !== 'detail' ? <input name="view" type="hidden" value={view} /> : null}
                <label className="block min-w-0 flex-1">
                  <span className="sr-only">{labels.searchPlaceholder}</span>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="form-field h-10 min-h-10 w-full pl-10"
                      onChange={(event) => setSearchInput(event.target.value)}
                      value={searchInput}
                      name="search"
                      placeholder={labels.searchPlaceholder}
                    />
                    {searchInput ? <button aria-label={labels.clearSearch} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => {
                      setSearchInput('')
                      void navigate({ search: '', status: activeStatus, archive: archiveFilter, sort, view })
                    }} type="button"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
                  </div>
                </label>
                <button className="button-secondary h-10 min-h-10 px-3" type="submit">
                  <Search aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">{labels.searchAction}</span>
                </button>
              </form>
            </div>

            <form
              action="/employees"
              className="flex items-center justify-end gap-3"
              method="get"
            >
              {search.trim() ? <input name="search" type="hidden" value={search.trim()} /> : null}
              {activeStatus !== 'ACTIVE_EMPLOYEE' ? <input name="status" type="hidden" value={activeStatus} /> : null}
              {archiveFilter !== 'active' ? <input name="archive" type="hidden" value={archiveFilter} /> : null}
              <label className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <LayoutList aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="sr-only">{labels.viewLabel}</span>
                <select
                  className="form-field h-10 min-h-10 w-full min-w-36 sm:w-40"
                  defaultValue={view}
                  name="view"
                  onChange={(event) => void navigate({ search, status: activeStatus, archive: archiveFilter, sort, view: event.target.value as EmployeeListView })}
                >
                  <option value="detail">{labels.viewDetail}</option>
                  <option value="compact">{labels.viewCompact}</option>
                </select>
              </label>
              <label className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <ArrowUpDown aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="sr-only">{labels.sortLabel}</span>
                <select
                  className="form-field h-10 min-h-10 w-full min-w-44 sm:w-48"
                  defaultValue={sort}
                  name="sort"
                  onChange={(event) => void navigate({ search, status: activeStatus, archive: archiveFilter, sort: event.target.value as EmployeeListSort, view })}
                >
                  <option value="last-name">{labels.sortLastName}</option>
                  <option value="first-name">{labels.sortFirstName}</option>
                </select>
              </label>
            </form>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t pt-4">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={labels.statusFilter}>
              <Link
                className={`filter-chip ${activeStatus === 'all' ? 'filter-chip-active' : ''}`}
                href={employeeListHref({ search, status: 'all', archive: archiveFilter, sort, view })}
                onClick={(event) => { event.preventDefault(); void navigate({ search, status: 'all', archive: archiveFilter, sort, view }) }}
              >
                {labels.all}
              </Link>
              {statusOptions.map((option) => (
                <Link
                  key={option.value}
                  className={`filter-chip ${activeStatus === option.value ? 'filter-chip-active' : ''}`}
                  href={employeeListHref({ search, status: option.value, archive: archiveFilter, sort, view })}
                  onClick={(event) => { event.preventDefault(); void navigate({ search, status: option.value, archive: archiveFilter, sort, view }) }}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={labels.archiveFilter}>
              {archiveOptions.map((option) => (
                <Link
                  key={option.value}
                  className={`filter-chip ${archiveFilter === option.value ? 'filter-chip-active' : ''}`}
                  href={employeeListHref({ search, status: activeStatus, archive: option.value, sort, view })}
                  onClick={(event) => { event.preventDefault(); void navigate({ search, status: activeStatus, archive: option.value, sort, view }) }}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      ) : null}
    </div>
  )
}
