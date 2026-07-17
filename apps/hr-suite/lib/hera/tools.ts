import type { AuthContext } from '@/lib/auth/permissions'
import { listMyReminders, type ReminderItem } from '@/lib/reminders/reminder-service'
import { createClient } from '@/lib/supabase/server'
import {
  addressChangeProposalSchema,
  employmentTimelineProposalSchema,
  placementChangeProposalSchema,
  reminderDraftSchema,
} from './schemas'
import type { HeRaToolCall } from './gemini'

export type HeRaToolResult =
  | { kind: 'PROFILE'; profile: { employeeNumber: string; firstName: string; lastName: string; workEmail: string | null } | null }
  | { kind: 'REMINDERS'; reminders: ReminderItem[] }
  | {
    kind: 'DRAFT'
    toolName: 'draft_personal_reminder' | 'draft_employee_address_change' | 'draft_employment_salary_change' | 'draft_employment_schedule_change' | 'draft_organization_placement_change'
    payload: Record<string, unknown>
    summary: string
    controlPayload: Record<string, unknown>
  }

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
  now: Date = new Date(),
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
    if (new Date(draft.remindAt).getTime() <= now.getTime()) {
      throw new Error('HERA_REMINDER_MUST_BE_FUTURE')
    }
    return {
      kind: 'DRAFT',
      toolName: 'draft_personal_reminder',
      payload: draft,
      summary: `Persoonlijke reminder: ${draft.title} op ${new Date(draft.remindAt).toLocaleString('nl-NL')}.`,
      controlPayload: { oldValue: null, newValue: draft },
    }
  }

  if (call.name === 'draft_employee_address_change') {
    const proposal = addressChangeProposalSchema.parse(call.args)
    const { currentValue, ...payload } = proposal
    return {
      kind: 'DRAFT', toolName: call.name, payload,
      summary: `Adreswijziging voor medewerker ${proposal.employeeId}.`,
      controlPayload: { oldValue: currentValue, newValue: proposal.input },
    }
  }

  if (call.name === 'draft_employment_salary_change' || call.name === 'draft_employment_schedule_change') {
    const proposal = employmentTimelineProposalSchema.parse(call.args)
    const expectedTimeline = call.name === 'draft_employment_salary_change' ? 'SALARY' : 'SCHEDULE'
    if (proposal.mutation.timeline !== expectedTimeline) throw new Error('HERA_TOOL_INPUT_INVALID')
    const { currentValue, ...payload } = proposal
    return {
      kind: 'DRAFT', toolName: call.name, payload,
      summary: `${expectedTimeline === 'SALARY' ? 'Salaris' : 'Rooster'}wijziging per ${proposal.mutation.effectiveOn}.`,
      controlPayload: { oldValue: currentValue, newValue: proposal.mutation },
    }
  }

  if (call.name === 'draft_organization_placement_change') {
    const proposal = placementChangeProposalSchema.parse(call.args)
    const { currentValue, ...payload } = proposal
    return {
      kind: 'DRAFT', toolName: call.name, payload,
      summary: `Wijziging van organisatieplaatsing ${proposal.placementId}.`,
      controlPayload: { oldValue: currentValue, newValue: proposal.input },
    }
  }

  throw new Error('HERA_TOOL_NOT_ALLOWED')
}
