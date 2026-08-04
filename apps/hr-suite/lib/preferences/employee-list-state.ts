import type { EmploymentStatus } from '@/lib/employment/employment-status'

export const ACTIVE_FUTURE_EXTERNAL_STATUS = 'ACTIVE_FUTURE_EXTERNAL' as const
export type EmployeeStatusFilter = EmploymentStatus | 'all' | typeof ACTIVE_FUTURE_EXTERNAL_STATUS
export type EmployeeArchiveFilter = 'active' | 'archived' | 'all'
export type EmployeeListSort = 'first-name' | 'last-name'
export type EmployeeListView = 'compact' | 'detail' | 'card' | 'photo-large' | 'photo' | 'photo-small' | 'photo-only' | 'photo-collage'
export type EmployeeListScope = 'all' | 'team'

export interface EmployeeListPreferences {
  status: EmployeeStatusFilter
  archive: EmployeeArchiveFilter
  sort: EmployeeListSort
  view: EmployeeListView
}

export type EmployeeListPreferencesPatch = Partial<EmployeeListPreferences>

export const DEFAULT_EMPLOYEE_LIST_PREFERENCES: EmployeeListPreferences = {
  status: 'ACTIVE_EMPLOYEE',
  archive: 'active',
  sort: 'last-name',
  view: 'detail',
}

const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  'ACTIVE_EMPLOYEE',
  'FUTURE_EMPLOYEE',
  'FORMER_EMPLOYEE',
  'NEVER_EMPLOYED',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmployeeStatus(value: unknown): value is EmploymentStatus {
  return typeof value === 'string' && EMPLOYMENT_STATUSES.includes(value as EmploymentStatus)
}

export function parseEmployeeListPreferences(value: unknown): EmployeeListPreferences {
  if (!isRecord(value)) return DEFAULT_EMPLOYEE_LIST_PREFERENCES
  return {
    status: value.status === 'all' || value.status === ACTIVE_FUTURE_EXTERNAL_STATUS || isEmployeeStatus(value.status) ? value.status : DEFAULT_EMPLOYEE_LIST_PREFERENCES.status,
    archive: value.archive === 'active' || value.archive === 'archived' || value.archive === 'all' ? value.archive : DEFAULT_EMPLOYEE_LIST_PREFERENCES.archive,
    sort: value.sort === 'first-name' || value.sort === 'last-name' ? value.sort : DEFAULT_EMPLOYEE_LIST_PREFERENCES.sort,
    view: value.view === 'compact' || value.view === 'detail' || value.view === 'card' || value.view === 'photo-large' || value.view === 'photo' || value.view === 'photo-small' || value.view === 'photo-only' || value.view === 'photo-collage' ? value.view : DEFAULT_EMPLOYEE_LIST_PREFERENCES.view,
  }
}

export function parseEmployeeListPreferencesPatch(value: unknown): EmployeeListPreferencesPatch | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  const allowedKeys = new Set(['status', 'archive', 'sort', 'view'])
  if (keys.length === 0 || keys.some((key) => !allowedKeys.has(key))) return null
  const patch: EmployeeListPreferencesPatch = {}
  for (const key of keys) {
    const item = value[key]
    if (key === 'status') {
      if (item !== 'all' && item !== ACTIVE_FUTURE_EXTERNAL_STATUS && !isEmployeeStatus(item)) return null
      patch.status = item
    }
    if (key === 'archive') {
      if (item !== 'active' && item !== 'archived' && item !== 'all') return null
      patch.archive = item
    }
    if (key === 'sort') {
      if (item !== 'first-name' && item !== 'last-name') return null
      patch.sort = item
    }
    if (key === 'view') {
      if (item !== 'compact' && item !== 'detail' && item !== 'card' && item !== 'photo-large' && item !== 'photo' && item !== 'photo-small' && item !== 'photo-only' && item !== 'photo-collage') return null
      patch.view = item
    }
  }
  return patch
}

export function employeeListHref(filters: {
  search: string
  status: EmployeeStatusFilter
  archive: EmployeeArchiveFilter
  sort: EmployeeListSort
  view: EmployeeListView
  scope?: EmployeeListScope
}): string {
  const params = new URLSearchParams()
  const search = filters.search.trim()
  if (search) params.set('search', search)
  if (filters.status === 'all') params.set('status', 'all')
  else if (filters.status === ACTIVE_FUTURE_EXTERNAL_STATUS) params.set('status', 'active-future-external')
  else if (filters.status !== 'ACTIVE_EMPLOYEE' || filters.scope === 'team') params.set('status', filters.status)
  if (filters.archive !== 'active') params.set('archive', filters.archive)
  if (filters.sort !== 'last-name') params.set('sort', filters.sort)
  if (filters.view !== 'detail') params.set('view', filters.view)
  if (filters.scope === 'team' || filters.scope === 'all') params.set('scope', filters.scope)
  const query = params.toString()
  return query ? `/employees?${query}` : '/employees'
}

export function employeeListMyTeamHref(): string {
  return employeeListHref({
    search: '',
    status: ACTIVE_FUTURE_EXTERNAL_STATUS,
    archive: 'active',
    sort: 'last-name',
    view: 'detail',
    scope: 'team',
  })
}

export function matchesEmployeeStatus(status: EmploymentStatus, filter: EmployeeStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === ACTIVE_FUTURE_EXTERNAL_STATUS) {
    return status === 'ACTIVE_EMPLOYEE' || status === 'FUTURE_EMPLOYEE' || status === 'NEVER_EMPLOYED'
  }
  return status === filter
}
