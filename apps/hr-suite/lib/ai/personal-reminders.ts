import 'server-only'

import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TablesInsert } from '@scope/db'
import { createPersonalReminder } from '@/lib/reminders/reminder-service'
import { personalReminderCreateSchema, type PersonalReminderCreateInput } from '@/lib/reminders/schemas'
import { AiExecutionError } from './contracts'

const personalReminderConfirmation = z.enum(['EXPLICIT_REQUEST', 'PROPOSAL_ACCEPTED'])

export const personalReminderToolArgumentsSchema = z.object({
  title: personalReminderCreateSchema.shape.title,
  description: z.string().trim().max(500).nullable().optional(),
  remindAt: personalReminderCreateSchema.shape.remindAt,
  confirmation: personalReminderConfirmation,
}).strict()

type ParsedPersonalReminderToolArguments = z.infer<typeof personalReminderToolArgumentsSchema>
export type PersonalReminderToolArguments = Omit<ParsedPersonalReminderToolArguments, 'description'> & { description?: string }

export const personalReminderToolParameters = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    description: { type: ['string', 'null'], maxLength: 500 },
    remindAt: { type: 'string', description: 'Absolute ISO-8601 timestamp including timezone offset.' },
    confirmation: { type: 'string', enum: ['EXPLICIT_REQUEST', 'PROPOSAL_ACCEPTED'] },
  },
  required: ['title', 'description', 'remindAt', 'confirmation'],
  additionalProperties: false,
} as const

export type PersonalReminderAiSource = 'EMPLOYEE_AI' | 'TEAM_AI'

export interface PersonalReminderToolResult {
  resultText: string
  reminderId: string
  title: string
  remindAt: string
  created: true
}

export interface PersonalReminderAiAuditInput {
  tenantId: string
  administrationId: string | null
  actorUserId: string
  reminderId: string
  source: PersonalReminderAiSource
  capability: 'create_personal_reminder'
  success: boolean
}

export interface PersonalReminderCapabilityDependencies {
  createPersonalReminder: (input: PersonalReminderCreateInput) => Promise<string>
  recordAudit: (input: PersonalReminderAiAuditInput) => Promise<void>
}

export class PersonalReminderToolError extends Error {
  constructor(readonly code: 'PERSONAL_REMINDER_INPUT_INVALID' | 'PERSONAL_REMINDER_FAILED', readonly status: 400 | 422) {
    super(code)
  }
}

export function parsePersonalReminderToolArguments(value: unknown): PersonalReminderToolArguments {
  const parsed = personalReminderToolArgumentsSchema.safeParse(value)
  if (!parsed.success) throw new AiExecutionError('INVALID_RESULT')
  return { ...parsed.data, description: parsed.data.description ?? undefined }
}

async function recordPersonalReminderAiAudit(input: PersonalReminderAiAuditInput): Promise<void> {
  try {
    const audit: TablesInsert<'audit_logs'> = {
      tenant_id: input.tenantId,
      administration_id: input.administrationId,
      entity_name: 'ai_personal_reminder',
      entity_id: input.reminderId,
      actor_user_id: input.actorUserId,
      action: 'CREATE',
      changes: {
        source: input.source,
        capability: input.capability,
        success: input.success,
      },
    }
    const { error } = await createAdminClient().from('audit_logs').insert(audit)
    if (error) {
      console.error('[AI_AUDIT] personal reminder audit failed', {
        entity: 'ai_personal_reminder',
        reminderId: input.reminderId,
        source: input.source,
        capability: input.capability,
        success: false,
      })
    }
  } catch {
    console.error('[AI_AUDIT] personal reminder audit unavailable', {
      entity: 'ai_personal_reminder',
      reminderId: input.reminderId,
      source: input.source,
      capability: input.capability,
      success: false,
    })
  }
}

const defaultDependencies: PersonalReminderCapabilityDependencies = {
  createPersonalReminder,
  recordAudit: recordPersonalReminderAiAudit,
}

export async function executePersonalReminderTool(
  input: {
    auth: Pick<AuthContext, 'tenantId' | 'administrationId' | 'userId'>
    source: PersonalReminderAiSource
    locale: 'nl' | 'en'
    arguments: unknown
  },
  dependencies: PersonalReminderCapabilityDependencies = defaultDependencies,
): Promise<PersonalReminderToolResult> {
  let args: PersonalReminderToolArguments
  try {
    args = parsePersonalReminderToolArguments(input.arguments)
  } catch {
    throw new PersonalReminderToolError('PERSONAL_REMINDER_INPUT_INVALID', 400)
  }

  try {
    const reminderId = await dependencies.createPersonalReminder({
      title: args.title,
      description: args.description,
      remindAt: args.remindAt,
    })
    await dependencies.recordAudit({
      tenantId: input.auth.tenantId,
      administrationId: input.auth.administrationId,
      actorUserId: input.auth.userId,
      reminderId,
      source: input.source,
      capability: 'create_personal_reminder',
      success: true,
    })
    return {
      resultText: input.locale === 'nl' ? 'Herinnering aangemaakt.' : 'Personal reminder created.',
      reminderId,
      title: args.title,
      remindAt: args.remindAt,
      created: true,
    }
  } catch (error) {
    if (error instanceof PersonalReminderToolError) throw error
    throw new PersonalReminderToolError('PERSONAL_REMINDER_FAILED', 422)
  }
}
