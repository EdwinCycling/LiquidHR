'use client'

import Link from 'next/link'
import { ArrowUpRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { TalentTeamMatrix } from '@/lib/talent/team-model'
import { filterTalentTeamMatrixRows } from '@/lib/talent/team-model'
import { talentTeamMatrixCapabilityTypes, talentTeamMatrixSources, talentTeamMatrixStatuses, type TalentTeamMatrixFilters } from '@/lib/talent/team-schemas'

type Labels = {
  title: string
  subtitle: string
  search: string
  searchPlaceholder: string
  type: string
  status: string
  validity?: string
  source: string
  all: string
  noResults: string
  empty: string
  employee: string
  job: string
  capabilities: string
  noCapabilities: string
  draft: string
  released: string
  expired: string
  self: string
  hr: string
  manager: string
  imported: string
  scope: string
  teamScope?: string
  tenantScope?: string
  employeeDrilldown?: string
  aggregateDisabled: string
  filterSearch?: string
  filterNoOptions?: string
  typeCompetency?: string
  typeSkill?: string
  typeKnowledge?: string
  typeLanguage?: string
  typeCertificate?: string
  evidence?: string
  evidencePresent?: string
  noEvidence?: string
}

type FilterState = {
  q: string
  type: (typeof talentTeamMatrixCapabilityTypes)[number] | ''
  status: (typeof talentTeamMatrixStatuses)[number] | ''
  source: (typeof talentTeamMatrixSources)[number] | ''
}

type FilterOption = { value: string; label: string }

function allowedValue<T extends string>(value: string | null, values: readonly T[]): T | '' {
  return value && values.includes(value as T) ? value as T : ''
}

function initialFilterState(searchParams: URLSearchParams): FilterState {
  return {
    q: searchParams.get('q') ?? '',
    type: allowedValue(searchParams.get('type'), talentTeamMatrixCapabilityTypes),
    status: allowedValue(searchParams.get('status'), talentTeamMatrixStatuses),
    source: allowedValue(searchParams.get('source'), talentTeamMatrixSources),
  }
}

function typeLabel(type: string, labels: Labels): string {
  if (type === 'COMPETENCY') return labels.typeCompetency ?? type
  if (type === 'SKILL') return labels.typeSkill ?? type
  if (type === 'KNOWLEDGE') return labels.typeKnowledge ?? type
  if (type === 'LANGUAGE') return labels.typeLanguage ?? type
  return labels.typeCertificate ?? type
}

function statusLabel(status: string, labels: Labels): string {
  if (status === 'DRAFT') return labels.draft
  if (status === 'RELEASED') return labels.released
  return labels.expired
}

function sourceLabel(source: string, labels: Labels): string {
  if (source === 'SELF_ENTERED') return labels.self
  if (source === 'MANAGER_ENTERED') return labels.manager
  if (source === 'IMPORTED') return labels.imported
  return labels.hr
}

function statusTone(status: string): BadgeTone {
  if (status === 'RELEASED') return 'success'
  if (status === 'EXPIRED') return 'danger'
  return 'warning'
}

function FilterSelect({ emptyLabel, label, onChange, options, searchPlaceholder, value }: { emptyLabel: string; label: string; onChange: (value: string) => void; options: FilterOption[]; searchPlaceholder: string; value: string }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
    <span className="truncate">{label}</span>
    <DropdownSelect aria-label={label} emptyLabel={emptyLabel} onChange={(event) => onChange(event.target.value)} searchable searchPlaceholder={searchPlaceholder} value={value}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </DropdownSelect>
  </label>
}

export function TalentTeamMatrix({ initial, labels }: { initial: TalentTeamMatrix; labels: Labels }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(() => initialFilterState(searchParams))

  useEffect(() => {
    const nextParams = new URLSearchParams(window.location.search)
    const setParam = (key: string, value: string) => { if (value) nextParams.set(key, value); else nextParams.delete(key) }
    setParam('q', filters.q.trim())
    setParam('type', filters.type)
    setParam('status', filters.status)
    setParam('source', filters.source)
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    if (`${pathname}${window.location.search}` !== nextUrl) window.history.replaceState(window.history.state, '', nextUrl)
  }, [filters, pathname])

  useEffect(() => {
    const handlePopState = () => setFilters(initialFilterState(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const matrixFilters = useMemo<TalentTeamMatrixFilters>(() => ({
    q: filters.q.trim() || undefined,
    type: filters.type || undefined,
    status: filters.status || undefined,
    source: filters.source || undefined,
  }), [filters.q, filters.source, filters.status, filters.type])
  const visible = useMemo(() => filterTalentTeamMatrixRows(initial.rows, matrixFilters), [initial.rows, matrixFilters])
  const typeOptions: FilterOption[] = [
    { value: '', label: labels.all },
    ...talentTeamMatrixCapabilityTypes.map((value) => ({ value, label: typeLabel(value, labels) })),
  ]
  const statusOptions: FilterOption[] = [
    { value: '', label: labels.all },
    { value: 'DRAFT', label: labels.draft },
    { value: 'RELEASED', label: labels.released },
    { value: 'EXPIRED', label: labels.expired },
  ]
  const sourceOptions: FilterOption[] = [
    { value: '', label: labels.all },
    { value: 'SELF_ENTERED', label: labels.self },
    { value: 'HR_ENTERED', label: labels.hr },
    { value: 'MANAGER_ENTERED', label: labels.manager },
    { value: 'IMPORTED', label: labels.imported },
  ]
  const scopeLabel = initial.scopeType === 'TENANT' ? labels.tenantScope ?? labels.scope : labels.teamScope ?? labels.scope
  const filterSearch = labels.filterSearch ?? labels.search
  const filterNoOptions = labels.filterNoOptions ?? labels.all
  const employeeDrilldown = labels.employeeDrilldown ?? labels.employee

  return <section className="mt-6 space-y-5">
    <Surface className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-sm font-semibold">{labels.title}</p><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.subtitle}</p></div>
        <Badge className="w-fit shrink-0" tone="info">{scopeLabel}: {initial.scopeCount}</Badge>
      </div>
      {initial.aggregateDisabled ? <p className="mt-4 border-t border-border-subtle pt-4 text-xs leading-5 text-muted-foreground">{labels.aggregateDisabled}</p> : null}
    </Surface>

    <Surface className="p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground md:col-span-1"><span className="truncate">{labels.search}</span><TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder={labels.searchPlaceholder} value={filters.q} /></label>
        <FilterSelect emptyLabel={filterNoOptions} label={labels.type} onChange={(value) => setFilters((current) => ({ ...current, type: value as FilterState['type'] }))} options={typeOptions} searchPlaceholder={filterSearch} value={filters.type} />
        <FilterSelect emptyLabel={filterNoOptions} label={labels.status} onChange={(value) => setFilters((current) => ({ ...current, status: value as FilterState['status'] }))} options={statusOptions} searchPlaceholder={filterSearch} value={filters.status} />
        <FilterSelect emptyLabel={filterNoOptions} label={labels.source} onChange={(value) => setFilters((current) => ({ ...current, source: value as FilterState['source'] }))} options={sourceOptions} searchPlaceholder={filterSearch} value={filters.source} />
      </div>
    </Surface>

    {initial.rows.length === 0 ? <EmptyState title={labels.empty} /> : visible.length === 0 ? <EmptyState title={labels.noResults} /> : <div className="grid gap-4 md:grid-cols-2">
      {visible.map((row) => <Surface className="min-w-0 p-4 sm:p-5" key={row.employeeId}>
        <article className="min-w-0">
          <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border-subtle pb-4">
            <div className="min-w-0">
              <Link aria-label={`${employeeDrilldown}: ${row.employeeLabel}`} className="inline-flex max-w-full items-center gap-1 break-words text-base font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/employees/${row.employeeId}`} prefetch={false}>{row.employeeLabel}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></Link>
              <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><div className="min-w-0"><dt className="inline">{labels.employee}: </dt><dd className="inline break-words">{row.employeeNumber}</dd></div><div className="min-w-0"><dt className="inline">{labels.job}: </dt><dd className="inline break-words">{row.jobTitle ?? '—'}</dd></div></dl>
            </div>
            <Badge className="shrink-0" tone="neutral">{row.capabilities.length} {labels.capabilities}</Badge>
          </header>

          <div className="mt-2 divide-y divide-border-subtle">
            {row.capabilities.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{labels.noCapabilities}</p> : row.capabilities.map((capability) => <div className="min-w-0 py-3 first:pt-2 last:pb-0" key={capability.id}>
              <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{capability.capabilityName}</p><p className="mt-1 break-words text-xs text-muted-foreground">{capability.capabilityCode} · {typeLabel(capability.capabilityType, labels)}</p></div><Badge className="shrink-0" tone={statusTone(capability.status)}>{statusLabel(capability.status, labels)}</Badge></div>
              <dl className="mt-3 grid min-w-0 gap-3 text-xs sm:grid-cols-3"><div className="min-w-0"><dt className="text-muted-foreground">{labels.source}</dt><dd className="mt-1 break-words font-medium">{sourceLabel(capability.source_type, labels)}</dd></div>{labels.validity ? <div className="min-w-0"><dt className="text-muted-foreground">{labels.validity}</dt><dd className="mt-1 break-words font-medium">{capability.valid_from}{capability.valid_until ? ` – ${capability.valid_until}` : ''}</dd></div> : null}{labels.evidence ? <div className="min-w-0"><dt className="text-muted-foreground">{labels.evidence}</dt><dd className="mt-1 break-words font-medium">{capability.evidence_status === 'VERIFIED' ? labels.evidencePresent : labels.noEvidence}</dd></div> : null}</dl>
            </div>)}
          </div>
        </article>
      </Surface>)}
    </div>}
  </section>
}
