import { AuthenticationError, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { createClient } from '@/lib/supabase/server'
import type {
  HrReminderCreateInput,
  PersonalReminderCreateInput,
  RecipientActionInput,
  ReminderUpdateInput,
} from './schemas'

type ReminderServiceStatus = 400 | 403 | 404 | 409 | 500

export class ReminderServiceError extends Error {
  constructor(readonly code: string, readonly status: ReminderServiceStatus) {
    super(code)
  }
}

interface DatabaseErrorLike {
  code?: string
  message: string
}

const DATABASE_ERROR_STATUSES: Readonly<Record<string, ReminderServiceStatus>> = {
  REMINDER_ACTION_INVALID: 400,
  REMINDER_IN_PAST: 400,
  REMINDER_TARGET_SCOPE_INVALID: 400,
  REMINDER_TARGETS_REQUIRED: 400,
  REMINDER_FORBIDDEN: 403,
  REMINDER_NOT_FOUND: 404,
  REMINDER_RECIPIENT_NOT_FOUND: 404,
  REMINDER_TARGET_NOT_FOUND: 404,
  REMINDER_NO_RECIPIENTS: 409,
  REMINDER_NOT_DRAFT: 409,
}

export function reminderDatabaseError(error: DatabaseErrorLike): ReminderServiceError {
  const code = Object.keys(DATABASE_ERROR_STATUSES).find((candidate) => error.message.includes(candidate))
  if (!code) return new ReminderServiceError('REMINDER_OPERATION_FAILED', 500)
  return new ReminderServiceError(code, DATABASE_ERROR_STATUSES[code] ?? 500)
}

interface ReminderRecipientResult {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'DISMISSED'
  effective_remind_at: string
  employee_id?: string | null
  employees?: { id: string; first_name: string | null; birth_name: string | null } | null
  reminders: {
    id: string
    title: string
    description: string | null
    remind_at: string
    reminder_type: 'PERSONAL' | 'HR'
    target_type: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
    status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
    created_by_user_id: string
  }
}

export interface ReminderItem {
  recipientId: string
  employeeId: string | null
  employeeName: string | null
  reminderId: string
  title: string
  description: string | null
  remindAt: string
  originalRemindAt: string
  type: 'PERSONAL' | 'HR'
  targetType: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
  recipientStatus: 'PENDING' | 'COMPLETED' | 'DISMISSED'
  reminderStatus: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  createdByUserId: string
  actionUrl?: string
}

export function reminderActionUrl(description: string | null): string | undefined {
  const match = description?.match(/(?:open|openen)\s+(\/(?:journeys\/[0-9a-f-]+#moment-[0-9a-f-]+|recruitment\/applications\/[0-9a-f-]+))/i)
  return match?.[1]
}

export interface ManagedReminder {
  id: string
  title: string
  description: string | null
  remindAt: string
  type: 'PERSONAL' | 'HR'
  targetType: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
}

export interface ReminderTargetOptions {
  departments: Array<{ id: string; name: string }>
  employees: Array<{ id: string; name: string; employeeNumber: string }>
}

export function toReminderItem(row: ReminderRecipientResult): ReminderItem {
  const actionUrl = reminderActionUrl(row.reminders.description)
  return {
    recipientId: row.id,
    employeeId: row.employee_id ?? row.employees?.id ?? null,
    employeeName: row.employees ? [row.employees.first_name, row.employees.birth_name].filter(Boolean).join(' ') || null : null,
    reminderId: row.reminders.id,
    title: row.reminders.title,
    description: row.reminders.description,
    remindAt: row.effective_remind_at,
    originalRemindAt: row.reminders.remind_at,
    type: row.reminders.reminder_type,
    targetType: row.reminders.target_type,
    recipientStatus: row.status,
    reminderStatus: row.reminders.status,
    createdByUserId: row.reminders.created_by_user_id,
    ...(actionUrl ? { actionUrl } : {}),
  }
}

async function requireReminderContext(): Promise<{
  tenantId: string
  administrationId: string | null
  userId: string
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || typeof userId !== 'string') throw new AuthenticationError('Je bent niet ingelogd.')
  const context = await loadActiveContext(userId)
  return {
    tenantId: context.tenant.id,
    administrationId: context.activeAdministration?.id ?? null,
    userId,
  }
}

type ReminderReadDependencies = {
  context: Pick<AuthContext, 'tenantId' | 'administrationId' | 'userId'>
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function listMyReminders(limit = 100, dependencies?: ReminderReadDependencies): Promise<ReminderItem[]> {
  const context = dependencies?.context ?? await requireReminderContext()
  const supabase = dependencies?.supabase ?? await createClient()
  let query = supabase
    .from('reminder_recipients')
    .select(`id, status, effective_remind_at, employee_id, employees(id, first_name, birth_name), reminders!inner(
      id, title, description, remind_at, reminder_type, target_type, status, created_by_user_id
    )`)
    .eq('tenant_id', context.tenantId)
    .eq('user_id', context.userId)
  query = context.administrationId
    ? query.eq('reminders.administration_id', context.administrationId)
    : query.is('reminders.administration_id', null)
  const { data, error } = await query
    .order('effective_remind_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200))

  if (error) throw reminderDatabaseError(error)
  return data.map((row) => toReminderItem(row as ReminderRecipientResult))
}

export async function listEmployeeReminders(employeeId: string, limit = 100): Promise<ReminderItem[]> {
  const context = await requirePermission('reminder:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('reminder_recipients').select(`id, status, effective_remind_at, employee_id, employees(id, first_name, birth_name), reminders!inner(id, title, description, remind_at, reminder_type, target_type, status, created_by_user_id)`).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).neq('reminders.status', 'CANCELLED').order('effective_remind_at', { ascending: true }).limit(Math.min(Math.max(limit, 1), 200))
  if (error) throw reminderDatabaseError(error)
  return data.map((row) => toReminderItem(row as ReminderRecipientResult))
}

export async function createPersonalReminder(input: PersonalReminderCreateInput): Promise<string> {
  const context = await requireReminderContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_personal_reminder', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: context.administrationId!,
    requested_title: input.title,
    requested_description: input.description ?? '',
    requested_remind_at: input.remindAt,
  })
  if (error) throw reminderDatabaseError(error)
  return data
}

export async function updatePersonalReminder(id: string, input: ReminderUpdateInput): Promise<void> {
  const context = await requireReminderContext()
  const supabase = await createClient()
  const { data: current, error: readError } = await supabase
    .from('reminders')
    .select('title, description, remind_at')
    .eq('tenant_id', context.tenantId)
    .eq('id', id)
    .eq('reminder_type', 'PERSONAL')
    .eq('created_by_user_id', context.userId)
    .maybeSingle()
  if (readError) throw reminderDatabaseError(readError)
  if (!current) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)

  const { error } = await supabase.rpc('update_personal_reminder', {
    requested_reminder_id: id,
    requested_title: input.title ?? current.title,
    requested_description: (input.description === undefined ? current.description : input.description) ?? '',
    requested_remind_at: input.remindAt ?? current.remind_at,
  })
  if (error) throw reminderDatabaseError(error)
}

export async function deletePersonalReminder(id: string): Promise<void> {
  const context = await requireReminderContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reminders')
    .delete()
    .eq('tenant_id', context.tenantId)
    .eq('id', id)
    .eq('reminder_type', 'PERSONAL')
    .eq('created_by_user_id', context.userId)
    .select('id')
    .maybeSingle()
  if (error) throw reminderDatabaseError(error)
  if (!data) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
}

export async function createHrReminder(input: HrReminderCreateInput): Promise<string> {
  const context = await requirePermission('reminder:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_hr_reminder', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: context.administrationId!,
    requested_title: input.title,
    requested_description: input.description ?? '',
    requested_remind_at: input.remindAt,
    requested_target_type: input.targetType,
    requested_target_ids: input.targetType === 'EVERYONE' ? [] : input.targetIds,
  })
  if (error) throw reminderDatabaseError(error)
  return data
}

export async function listManagedReminders(): Promise<ManagedReminder[]> {
  const context = await requirePermission('reminder:read')
  const supabase = await createClient()
  let query = supabase
    .from('reminders')
    .select('id, title, description, remind_at, reminder_type, target_type, status')
    .eq('tenant_id', context.tenantId)
    .eq('reminder_type', 'HR')
  query = context.administrationId
    ? query.eq('administration_id', context.administrationId)
    : query.is('administration_id', null)
  const { data, error } = await query.order('remind_at', { ascending: false }).limit(100)
  if (error) throw reminderDatabaseError(error)
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    remindAt: row.remind_at,
    type: row.reminder_type,
    targetType: row.target_type,
    status: row.status,
  }))
}

export async function listReminderTargetOptions(): Promise<ReminderTargetOptions> {
  const context = await requirePermission('reminder:write')
  const supabase = await createClient()
  const departmentsQuery = supabase
    .from('departments')
    .select('id, name')
    .eq('tenant_id', context.tenantId)
    .eq('is_active', true)
  const [departmentsResult, employeesResult] = await Promise.all([
    departmentsQuery.order('name').limit(200),
    supabase
      .from('employees')
      .select('id, first_name, birth_name, employee_number')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('birth_name')
      .limit(200),
  ])
  if (departmentsResult.error) throw reminderDatabaseError(departmentsResult.error)
  if (employeesResult.error) throw reminderDatabaseError(employeesResult.error)
  return {
    departments: departmentsResult.data.map((row) => ({ id: row.id, name: row.name })),
    employees: employeesResult.data.map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.birth_name}`,
      employeeNumber: row.employee_number,
    })),
  }
}

export async function publishReminder(id: string): Promise<number> {
  await requirePermission('reminder:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_reminder', { requested_reminder_id: id })
  if (error) throw reminderDatabaseError(error)
  return data
}

export async function cancelHrReminder(id: string): Promise<void> {
  const context = await requirePermission('reminder:write')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId)
    .eq('id', id)
    .eq('reminder_type', 'HR')
    .neq('status', 'CANCELLED')
    .select('id')
    .maybeSingle()
  if (error) throw reminderDatabaseError(error)
  if (!data) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
}

export async function updateHrReminder(id: string, input: ReminderUpdateInput): Promise<void> {
  const context = await requirePermission('reminder:write')
  const supabase = await createClient()
  const { data: current, error: readError } = await supabase.from('reminders').select('title, description, remind_at').eq('tenant_id', context.tenantId).eq('id', id).eq('reminder_type', 'HR').maybeSingle()
  if (readError) throw reminderDatabaseError(readError)
  if (!current) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
  const { error } = await supabase.from('reminders').update({ title: input.title ?? current.title, description: input.description === undefined ? current.description : input.description, remind_at: input.remindAt ?? current.remind_at }).eq('tenant_id', context.tenantId).eq('id', id).eq('reminder_type', 'HR')
  if (error) throw reminderDatabaseError(error)
}

export async function deleteHrReminder(id: string): Promise<void> {
  const context = await requirePermission('reminder:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('reminders').delete().eq('tenant_id', context.tenantId).eq('id', id).eq('reminder_type', 'HR').select('id').maybeSingle()
  if (error) throw reminderDatabaseError(error)
  if (!data) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
}

export async function updateReminder(id: string, input: ReminderUpdateInput): Promise<void> {
  const context = await requireReminderContext()
  const supabase = await createClient()
  const { data, error } = await supabase.from('reminders').select('reminder_type, created_by_user_id').eq('tenant_id', context.tenantId).eq('id', id).maybeSingle()
  if (error) throw reminderDatabaseError(error)
  if (!data) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
  if (data.reminder_type === 'PERSONAL') return updatePersonalReminder(id, input)
  return updateHrReminder(id, input)
}

export async function deleteReminder(id: string): Promise<void> {
  const context = await requireReminderContext()
  const supabase = await createClient()
  const { data, error } = await supabase.from('reminders').select('reminder_type').eq('tenant_id', context.tenantId).eq('id', id).maybeSingle()
  if (error) throw reminderDatabaseError(error)
  if (!data) throw new ReminderServiceError('REMINDER_NOT_FOUND', 404)
  if (data.reminder_type === 'PERSONAL') return deletePersonalReminder(id)
  return deleteHrReminder(id)
}

export async function updateRecipient(id: string, input: RecipientActionInput): Promise<void> {
  await requireReminderContext()
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_reminder_recipient', {
    requested_recipient_id: id,
    requested_action: input.action,
    requested_remind_at: input.action === 'SNOOZE' ? input.remindAt : undefined,
  })
  if (error) throw reminderDatabaseError(error)
}
