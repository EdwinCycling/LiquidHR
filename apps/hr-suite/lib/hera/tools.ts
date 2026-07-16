import type { AuthContext } from '@/lib/auth/permissions'
import { listMyReminders, type ReminderItem } from '@/lib/reminders/reminder-service'
import { createClient } from '@/lib/supabase/server'
import { reminderDraftSchema } from './schemas'
import type { HeRaToolCall } from './gemini'

export type HeRaToolResult =
  | { kind: 'PROFILE'; profile: { employeeNumber: string; firstName: string; lastName: string; workEmail: string | null } | null }
  | { kind: 'REMINDERS'; reminders: ReminderItem[] }
  | { kind: 'DRAFT'; toolName: 'draft_personal_reminder'; payload: { title: string; remindAt: string; description?: string }; summary: string }

export interface HeRaToolDependencies {
  listMyReminders?: () => Promise<ReminderItem[]>
  createPersonalReminder?: () => Promise<string>
  getMyProfile?: (context: AuthContext) => Promise<{ employeeNumber: string; firstName: string; lastName: string; workEmail: string | null } | null>
}

async function getMyProfile(context: AuthContext) {
  if (!context.employeeId) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('employee_number, first_name, birth_name, work_email')
    .eq('tenant_id', context.tenantId)
    .eq('id', context.employeeId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    employeeNumber: data.employee_number,
    firstName: data.first_name,
    lastName: data.birth_name,
    workEmail: data.work_email,
  }
}

export async function executeHeRaTool(
  context: AuthContext,
  call: HeRaToolCall,
  dependencies: HeRaToolDependencies = {},
): Promise<HeRaToolResult> {
  if (call.name === 'get_my_profile') {
    const profile = await (dependencies.getMyProfile ?? getMyProfile)(context)
    return { kind: 'PROFILE', profile }
  }

  if (call.name === 'list_my_reminders') {
    const reminders = await (dependencies.listMyReminders ?? listMyReminders)()
    return { kind: 'REMINDERS', reminders }
  }

  if (call.name === 'draft_personal_reminder') {
    const draft = reminderDraftSchema.parse(call.args)
    return {
      kind: 'DRAFT',
      toolName: 'draft_personal_reminder',
      payload: draft,
      summary: `Persoonlijke reminder: ${draft.title} op ${new Date(draft.remindAt).toLocaleString('nl-NL')}.`,
    }
  }

  throw new Error('HERA_TOOL_NOT_ALLOWED')
}
