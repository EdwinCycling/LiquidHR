import 'server-only'

import type { Json } from '@scope/db'
import { z } from 'zod'
import { requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export interface EmployeeDirectorySettings {
  enabled: boolean
  showName: boolean
  showJobDepartment: boolean
  showWorkEmail: boolean
  showWorkPhone: boolean
  showPresence: boolean
  showSchedule: boolean
}

export type EmployeeDirectoryVisibility = Pick<EmployeeDirectorySettings, 'enabled' | 'showName' | 'showJobDepartment' | 'showWorkEmail' | 'showWorkPhone' | 'showPresence' | 'showSchedule'>

export interface EmployeeDirectoryDetail {
  employeeId: string
  name?: string
  avatarUrl: string | null
  jobTitle?: string | null
  departmentName?: string | null
  workEmail?: string | null
  workPhone?: string | null
  schedule?: Array<{
    weekIndex: number
    isoWeekday: number
    isWorkingDay: boolean
    startsAt: string | null
    endsAt: string | null
    scheduledMinutes: number
  }>
  presence?: Array<{ date: string; status: 'WORKING' | 'OFF' | 'ABSENT' }>
}

export const employeeDirectorySettingsSchema = z.object({
  enabled: z.boolean(),
  showName: z.boolean(),
  showJobDepartment: z.boolean(),
  showWorkEmail: z.boolean(),
  showWorkPhone: z.boolean(),
  showPresence: z.boolean(),
  showSchedule: z.boolean(),
})

export type EmployeeDirectorySettingsInput = z.infer<typeof employeeDirectorySettingsSchema>

export class EmployeeDirectoryError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 500) {
    super(code)
  }
}

function administrationId(value: string | null): string {
  if (!value) throw new EmployeeDirectoryError('ADMINISTRATION_REQUIRED', 400)
  return value
}

function mapSettings(row: {
  employee_directory_enabled: boolean
  employee_directory_show_name: boolean
  employee_directory_show_job_department: boolean
  employee_directory_show_work_email: boolean
  employee_directory_show_work_phone: boolean
  employee_directory_show_presence: boolean
  employee_directory_show_schedule: boolean
}): EmployeeDirectorySettings {
  return {
    enabled: row.employee_directory_enabled,
    showName: true,
    showJobDepartment: row.employee_directory_show_job_department,
    showWorkEmail: row.employee_directory_show_work_email,
    showWorkPhone: row.employee_directory_show_work_phone,
    showPresence: row.employee_directory_show_presence,
    showSchedule: row.employee_directory_show_schedule,
  }
}

function mapVisibility(value: Json): EmployeeDirectoryVisibility {
  const raw = record(value)
  return {
    enabled: booleanValue(raw.enabled),
    showName: true,
    showJobDepartment: booleanValue(raw.showJobDepartment),
    showWorkEmail: booleanValue(raw.showWorkEmail),
    showWorkPhone: booleanValue(raw.showWorkPhone),
    showPresence: booleanValue(raw.showPresence),
    showSchedule: booleanValue(raw.showSchedule),
  }
}

export async function getEmployeeDirectorySettings(): Promise<EmployeeDirectorySettings> {
  const context = await requirePermission('settings:read')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('administration_hr_settings')
    .select('employee_directory_enabled, employee_directory_show_name, employee_directory_show_job_department, employee_directory_show_work_email, employee_directory_show_work_phone, employee_directory_show_presence, employee_directory_show_schedule')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', adminId)
    .maybeSingle()
  if (error || !data) throw new EmployeeDirectoryError('SETTINGS_READ_FAILED', 500)
  return mapSettings(data)
}

export async function updateEmployeeDirectorySettings(rawInput: unknown): Promise<void> {
  const context = await requirePermission('settings:write')
  const input = employeeDirectorySettingsSchema.parse(rawInput)
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase
    .from('administration_hr_settings')
    .update({
      employee_directory_enabled: input.enabled,
      employee_directory_show_name: true,
      employee_directory_show_job_department: input.showJobDepartment,
      employee_directory_show_work_email: input.showWorkEmail,
      employee_directory_show_work_phone: input.showWorkPhone,
      employee_directory_show_presence: input.showPresence,
      employee_directory_show_schedule: input.showSchedule,
    })
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', adminId)
  if (error) throw new EmployeeDirectoryError('SETTINGS_UPDATE_FAILED', 500)
}

export async function getEmployeeDirectoryVisibility(): Promise<EmployeeDirectoryVisibility> {
  const context = await requireAnyPermission(['employee-directory:read', 'employee:read'])
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_employee_directory_visibility', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: adminId,
  })
  if (error || data === null) throw new EmployeeDirectoryError('VISIBILITY_READ_FAILED', 500)
  return mapVisibility(data)
}

export async function getEmployeeDirectoryAccess(): Promise<boolean> {
  const context = await requirePermission('employee-directory:read')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_employee_directory_access', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: adminId,
  })
  if (error) throw new EmployeeDirectoryError('ACCESS_READ_FAILED', 500)
  return data ?? true
}

function record(value: Json): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new EmployeeDirectoryError('DETAIL_INVALID', 500)
  return value
}

function stringValue(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: Json | undefined): number {
  return typeof value === 'number' ? value : 0
}

function booleanValue(value: Json | undefined): boolean {
  return value === true
}

function parseDetail(value: Json): EmployeeDirectoryDetail {
  const raw = record(value)
  const presence = Array.isArray(raw.presence)
    ? raw.presence.map((item) => {
      const row = record(item)
      const status = stringValue(row.status)
      if (status !== 'WORKING' && status !== 'OFF' && status !== 'ABSENT') throw new EmployeeDirectoryError('DETAIL_INVALID', 500)
      const normalizedStatus: 'WORKING' | 'OFF' | 'ABSENT' = status
      return { date: stringValue(row.date) ?? '', status: normalizedStatus }
    })
    : undefined
  const schedule = Array.isArray(raw.schedule)
    ? raw.schedule.map((item) => {
      const row = record(item)
      return {
        weekIndex: numberValue(row.weekIndex),
        isoWeekday: numberValue(row.isoWeekday),
        isWorkingDay: booleanValue(row.isWorkingDay),
        startsAt: stringValue(row.startsAt),
        endsAt: stringValue(row.endsAt),
        scheduledMinutes: numberValue(row.scheduledMinutes),
      }
    })
    : undefined
  return {
    employeeId: stringValue(raw.employeeId) ?? '',
    name: stringValue(raw.name) ?? undefined,
    avatarUrl: stringValue(raw.avatarUrl),
    jobTitle: raw.jobTitle === null ? null : stringValue(raw.jobTitle) ?? undefined,
    departmentName: raw.departmentName === null ? null : stringValue(raw.departmentName) ?? undefined,
    workEmail: raw.workEmail === null ? null : stringValue(raw.workEmail) ?? undefined,
    workPhone: raw.workPhone === null ? null : stringValue(raw.workPhone) ?? undefined,
    schedule,
    presence,
  }
}

function weekStart(): string {
  const now = new Date()
  const day = now.getUTCDay() || 7
  now.setUTCDate(now.getUTCDate() - day + 1)
  return now.toISOString().slice(0, 10)
}

export async function getEmployeeDirectoryDetail(employeeId: string): Promise<EmployeeDirectoryDetail> {
  const context = await requireAnyPermission(['employee-directory:read', 'employee:read'])
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_employee_directory_detail', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: adminId,
    requested_employee_id: employeeId,
    requested_week_start: weekStart(),
  })
  if (error) {
    if (error.code === '42501') throw new EmployeeDirectoryError('DIRECTORY_NOT_AVAILABLE', 403)
    if (error.code === 'P0002') throw new EmployeeDirectoryError('EMPLOYEE_NOT_FOUND', 404)
    throw new EmployeeDirectoryError('DETAIL_READ_FAILED', 500)
  }
  return parseDetail(data)
}
