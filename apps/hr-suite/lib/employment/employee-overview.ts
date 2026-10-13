import type { Database, Json } from '@scope/db'
import { resolveStoredImageUrl } from '@/lib/storage/image-url'
import { deriveEmploymentStatus, type EmploymentStatus } from './employment-status'

export interface EmployeeOverview {
  id: string
  employeeNumber: string
  firstName: string
  birthNamePrefix: string | null
  birthName: string
  departmentName: string | null
  jobTitle: string | null
  workEmail: string | null
  avatarUrl: string | null
  isArchived: boolean
  status: EmploymentStatus
  employmentCount: number
  employmentType: Database['public']['Enums']['employment_type'] | null
  administrationNames: string[]
  hrGroupAdministrationCount: number
}

export interface EmployeeOverviewRpcRow {
  id: string
  employee_number: string
  first_name: string
  birth_name_prefix: string | null
  birth_name: string
  work_email: string | null
  avatar_url: string | null
  is_archived: boolean
  employment_history: Json
  department_name: string | null
  job_title: string | null
}

interface EmployeeOverviewEmployment {
  starts_on: string
  ends_on: string | null
  record_status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
}

function parseEmploymentHistory(value: Json): EmployeeOverviewEmployment[] {
  if (!Array.isArray(value)) throw new Error('EMPLOYEE_OVERVIEW_HISTORY_INVALID')
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error('EMPLOYEE_OVERVIEW_HISTORY_INVALID')
    const startsOn = entry.starts_on
    const endsOn = entry.ends_on
    const recordStatus = entry.record_status
    if (
      typeof startsOn !== 'string'
      || (typeof endsOn !== 'string' && endsOn !== null)
      || (recordStatus !== 'DRAFT' && recordStatus !== 'CONFIRMED' && recordStatus !== 'CANCELLED')
    ) throw new Error('EMPLOYEE_OVERVIEW_HISTORY_INVALID')
    return { starts_on: startsOn, ends_on: endsOn, record_status: recordStatus }
  })
}

export function mapEmployeeOverviewRpcRow(row: EmployeeOverviewRpcRow, today: string): EmployeeOverview {
  const periods = parseEmploymentHistory(row.employment_history).map((employment) => ({
    startsOn: employment.starts_on,
    endsOn: employment.ends_on,
    recordStatus: employment.record_status,
  }))
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    birthNamePrefix: row.birth_name_prefix,
    birthName: row.birth_name,
    departmentName: row.department_name,
    jobTitle: row.job_title,
    workEmail: row.work_email,
    avatarUrl: resolveStoredImageUrl(row.avatar_url, { kind: 'employee-avatar', employeeId: row.id }),
    isArchived: row.is_archived,
    status: deriveEmploymentStatus(periods, today),
    employmentCount: periods.length,
    employmentType: null,
    administrationNames: [],
    hrGroupAdministrationCount: 0,
  }
}

export interface EmployeeOverviewPageMappedRows {
  employees: EmployeeOverview[]
  limitedDetailEmployeeIds: string[]
}

const PAGE_EMPLOYMENT_TYPES = [
  'EMPLOYEE',
  'INTERN',
  'APPRENTICE',
  'CONTRACTOR',
  'TEMPORARY_AGENCY',
  'FREELANCER',
  'VOLUNTEER',
  'NO_PAYROLL',
] as const

function pageRecord(value: Json): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
  return value
}

function pageString(record: Record<string, Json | undefined>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
  return value
}

function pageNullableString(record: Record<string, Json | undefined>, key: string): string | null {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
  return value
}

function pageCount(record: Record<string, Json | undefined>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
  return value
}

export function mapEmployeeOverviewPageRows(value: Json): EmployeeOverviewPageMappedRows {
  if (!Array.isArray(value) || value.length > 50) throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROWS_INVALID')

  const employees: EmployeeOverview[] = []
  const limitedDetailEmployeeIds: string[] = []
  const seenIds = new Set<string>()

  for (const item of value) {
    const record = pageRecord(item)
    const id = pageString(record, 'id')
    const employmentStatus = pageString(record, 'status')
    if (
      employmentStatus !== 'ACTIVE_EMPLOYEE'
      && employmentStatus !== 'FUTURE_EMPLOYEE'
      && employmentStatus !== 'FORMER_EMPLOYEE'
      && employmentStatus !== 'NEVER_EMPLOYED'
    ) throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
    if (seenIds.has(id)) throw new Error('EMPLOYEE_OVERVIEW_PAGE_DUPLICATE_EMPLOYEE')
    seenIds.add(id)

    const rawEmploymentType = record.employment_type
    const employmentType = rawEmploymentType === null || rawEmploymentType === undefined
      ? null
      : typeof rawEmploymentType === 'string' && PAGE_EMPLOYMENT_TYPES.includes(rawEmploymentType as typeof PAGE_EMPLOYMENT_TYPES[number])
        ? rawEmploymentType as Database['public']['Enums']['employment_type']
        : (() => { throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID') })()
    const rawAdministrationNames = record.administration_names
    if (!Array.isArray(rawAdministrationNames) || rawAdministrationNames.some((name) => typeof name !== 'string')) {
      throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
    }
    if (typeof record.is_archived !== 'boolean' || typeof record.limited_detail !== 'boolean') {
      throw new Error('EMPLOYEE_OVERVIEW_PAGE_ROW_INVALID')
    }

    employees.push({
      id,
      employeeNumber: pageNullableString(record, 'employee_number') ?? '',
      firstName: pageString(record, 'first_name'),
      birthNamePrefix: pageNullableString(record, 'birth_name_prefix'),
      birthName: pageString(record, 'birth_name'),
      departmentName: pageNullableString(record, 'department_name'),
      jobTitle: pageNullableString(record, 'job_title'),
      workEmail: pageNullableString(record, 'work_email'),
      avatarUrl: resolveStoredImageUrl(pageNullableString(record, 'avatar_url'), { kind: 'employee-avatar', employeeId: id }),
      isArchived: record.is_archived,
      status: employmentStatus,
      employmentCount: pageCount(record, 'employment_count'),
      employmentType,
      administrationNames: rawAdministrationNames as string[],
      hrGroupAdministrationCount: pageCount(record, 'hr_group_administration_count'),
    })
    if (record.limited_detail) limitedDetailEmployeeIds.push(id)
  }

  return { employees, limitedDetailEmployeeIds }
}

export interface EmployeeOverviewPageRange {
  from: number
  to: number
  pageCount: number
}

export function getEmployeeOverviewPageRange(totalCount: number, page: number, pageSize = 50): EmployeeOverviewPageRange {
  if (
    !Number.isSafeInteger(totalCount)
    || totalCount < 0
    || !Number.isSafeInteger(page)
    || page < 1
    || !Number.isSafeInteger(pageSize)
    || pageSize < 1
  ) throw new Error('EMPLOYEE_OVERVIEW_PAGE_RANGE_INVALID')

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalCount === 0 || page > pageCount) return { from: 0, to: 0, pageCount }
  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, totalCount),
    pageCount,
  }
}
