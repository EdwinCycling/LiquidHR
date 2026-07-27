import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { EmployeeNoteCreateInput, EmployeeNoteUpdateInput } from './employee-notes-schemas'

export class EmployeeNoteServiceError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 500) {
    super(code)
  }
}

export interface EmployeeNote {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  authorName: string
}

interface NoteRow {
  id: string
  title: string
  description: string
  created_at: string
  updated_at: string
  created_by_user_id: string
}

async function requireAdministration(employeeId: string, permission: string) {
  const context = await requirePermission(permission, employeeId)
  const administrationId = context.administrationId
  if (!administrationId) throw new EmployeeNoteServiceError('ADMINISTRATION_REQUIRED', 400)
  return { ...context, administrationId }
}

async function authorNames(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('auth_user_id, first_name, birth_name').in('auth_user_id', userIds).is('deleted_at', null)
  if (error) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_AUTHOR_READ_FAILED', 500)
  return new Map((data ?? []).flatMap((employee) => employee.auth_user_id ? [[employee.auth_user_id, `${employee.first_name} ${employee.birth_name}`] as const] : []))
}

function mapNote(row: NoteRow, names: Map<string, string>): EmployeeNote {
  return { id: row.id, title: row.title, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at, authorName: names.get(row.created_by_user_id) ?? 'Onbekende gebruiker' }
}

export async function listEmployeeNotes(employeeId: string): Promise<EmployeeNote[]> {
  const context = await requireAdministration(employeeId, 'employee-note:read')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_notes').select('id, title, description, created_at, updated_at, created_by_user_id').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(200)
  if (error) throw new EmployeeNoteServiceError('EMPLOYEE_NOTES_READ_FAILED', 500)
  const rows = (data ?? []) as NoteRow[]
  const names = await authorNames(rows.map((item) => item.created_by_user_id))
  return rows.map((row) => mapNote(row, names))
}

export async function createEmployeeNote(employeeId: string, input: EmployeeNoteCreateInput): Promise<EmployeeNote> {
  const context = await requireAdministration(employeeId, 'employee-note:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_notes').insert({ tenant_id: context.tenantId, administration_id: context.administrationId, employee_id: employeeId, title: input.title, description: input.description, created_by_user_id: context.userId, updated_by_user_id: context.userId }).select('id, title, description, created_at, updated_at, created_by_user_id').single()
  if (error || !data) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_CREATE_FAILED', 500)
  const names = await authorNames([context.userId])
  return mapNote(data as NoteRow, names)
}

export async function updateEmployeeNote(employeeId: string, noteId: string, input: EmployeeNoteUpdateInput): Promise<void> {
  const context = await requireAdministration(employeeId, 'employee-note:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_notes').update({ ...input, updated_by_user_id: context.userId }).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('employee_id', employeeId).eq('id', noteId).select('id').maybeSingle()
  if (error) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_NOT_FOUND', 404)
}

export async function deleteEmployeeNote(employeeId: string, noteId: string): Promise<void> {
  const context = await requireAdministration(employeeId, 'employee-note:delete')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_notes').delete().eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('employee_id', employeeId).eq('id', noteId).select('id').maybeSingle()
  if (error) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_DELETE_FAILED', 500)
  if (!data) throw new EmployeeNoteServiceError('EMPLOYEE_NOTE_NOT_FOUND', 404)
}

export async function employeeNotesPermissionAllowed(employeeId: string): Promise<boolean> {
  try {
    await requirePermission('employee-note:read', employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}
