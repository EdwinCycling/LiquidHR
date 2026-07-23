import type { Json } from '@scope/db'
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

function employeeAvatarHref(employeeId: string, storedValue: string | null): string | null {
  if (!storedValue) return null
  return storedValue.startsWith('storage://') ? `/api/employees/${employeeId}/avatar` : storedValue
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
    avatarUrl: employeeAvatarHref(row.id, row.avatar_url),
    isArchived: row.is_archived,
    status: deriveEmploymentStatus(periods, today),
    employmentCount: periods.length,
  }
}
