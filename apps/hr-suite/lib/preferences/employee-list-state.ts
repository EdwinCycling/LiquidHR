import type { EmploymentStatus } from '@/lib/employment/employment-status'

export type EmployeeStatusFilter = EmploymentStatus | 'all'
export type EmployeeArchiveFilter = 'active' | 'archived' | 'all'
export type EmployeeListSort = 'first-name' | 'last-name'
export type EmployeeListView = 'compact' | 'detail'

export interface EmployeeListPreferences {
  filterPanelOpen: boolean
  status: EmployeeStatusFilter
  archive: EmployeeArchiveFilter
  sort: EmployeeListSort
  view: EmployeeListView
}

export type EmployeeListPreferencesPatch = Partial<EmployeeListPreferences>

export const DEFAULT_EMPLOYEE_LIST_PREFERENCES: EmployeeListPreferences = {
  filterPanelOpen: true,
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
    filterPanelOpen: typeof value.filterPanelOpen === 'boolean' ? value.filterPanelOpen : true,
    status: value.status === 'all' || isEmployeeStatus(value.status) ? value.status : DEFAULT_EMPLOYEE_LIST_PREFERENCES.status,
    archive: value.archive === 'active' || value.archive === 'archived' || value.archive === 'all' ? value.archive : DEFAULT_EMPLOYEE_LIST_PREFERENCES.archive,
    sort: value.sort === 'first-name' || value.sort === 'last-name' ? value.sort : DEFAULT_EMPLOYEE_LIST_PREFERENCES.sort,
    view: value.view === 'compact' || value.view === 'detail' ? value.view : DEFAULT_EMPLOYEE_LIST_PREFERENCES.view,
  }
}

export function parseEmployeeListPreferencesPatch(value: unknown): EmployeeListPreferencesPatch | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  const allowedKeys = new Set(['filterPanelOpen', 'status', 'archive', 'sort', 'view'])
  if (keys.length === 0 || keys.some((key) => !allowedKeys.has(key))) return null
  const patch: EmployeeListPreferencesPatch = {}
  for (const key of keys) {
    const item = value[key]
    if (key === 'filterPanelOpen') {
      if (typeof item !== 'boolean') return null
      patch.filterPanelOpen = item
    }
    if (key === 'status') {
      if (item !== 'all' && !isEmployeeStatus(item)) return null
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
      if (item !== 'compact' && item !== 'detail') return null
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
}): string {
  const params = new URLSearchParams()
  const search = filters.search.trim()
  if (search) params.set('search', search)
  if (filters.status === 'all') params.set('status', 'all')
  else if (filters.status !== 'ACTIVE_EMPLOYEE') params.set('status', filters.status)
  if (filters.archive !== 'active') params.set('archive', filters.archive)
  if (filters.sort !== 'last-name') params.set('sort', filters.sort)
  if (filters.view !== 'detail') params.set('view', filters.view)
  const query = params.toString()
  return query ? `/employees?${query}` : '/employees'
}
