import type { Json } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import { createPersonalReminder } from '@/lib/reminders/reminder-service'
import { createClient } from '@/lib/supabase/server'
import { reminderDraftSchema } from './schemas'

export type HeRaActionType =
  | 'PERSONAL_REMINDER'
  | 'EMPLOYEE_ADDRESS_CHANGE'
  | 'EMPLOYMENT_SALARY_CHANGE'
  | 'EMPLOYMENT_SCHEDULE_CHANGE'
  | 'ORGANIZATION_PLACEMENT_CHANGE'

interface ClaimedActionDraft {
  id: string
  actionType: HeRaActionType
  version: number
  expiresAt: string
  payload: Json
}

interface ConfirmActionDraftInput {
  draftId: string
  expectedVersion: number
}

interface ActionResult {
  entityId: string
}

export interface HeRaActionDraftDependencies {
  claimDraft?: (
    context: AuthContext,
    draftId: string,
    expectedVersion: number,
  ) => Promise<ClaimedActionDraft | null>
  executeAction?: (context: AuthContext, draft: ClaimedActionDraft) => Promise<ActionResult>
  markSucceeded?: (context: AuthContext, draftId: string) => Promise<void>
  markFailed?: (context: AuthContext, draftId: string, failureCode: string) => Promise<void>
}

export class HeRaActionDraftError extends Error {
  constructor(readonly code: 'DRAFT_NOT_CONFIRMABLE' | 'DRAFT_ACTION_NOT_SUPPORTED') {
    super(code)
  }
}

async function claimDraft(
  context: AuthContext,
  draftId: string,
  expectedVersion: number,
): Promise<ClaimedActionDraft | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_action_drafts')
    .update({ status: 'EXECUTING' })
    .eq('id', draftId)
    .eq('tenant_id', context.tenantId)
    .eq('owner_user_id', context.userId)
    .eq('status', 'AWAITING_CONFIRMATION')
    .eq('version', expectedVersion)
    .gt('expires_at', new Date().toISOString())
    .select('id, action_type, version, expires_at, payload')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    actionType: data.action_type as HeRaActionType,
    version: data.version,
    expiresAt: data.expires_at,
    payload: data.payload,
  }
}

async function executeAction(_context: AuthContext, draft: ClaimedActionDraft): Promise<ActionResult> {
  if (draft.actionType !== 'PERSONAL_REMINDER') {
    throw new HeRaActionDraftError('DRAFT_ACTION_NOT_SUPPORTED')
  }
  const payload = reminderDraftSchema.parse(draft.payload)
  const entityId = await createPersonalReminder(payload)
  return { entityId }
}

async function markSucceeded(context: AuthContext, draftId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_action_drafts')
    .update({ status: 'SUCCEEDED', executed_at: new Date().toISOString(), failure_code: null })
    .eq('id', draftId)
    .eq('tenant_id', context.tenantId)
    .eq('owner_user_id', context.userId)
    .eq('status', 'EXECUTING')
  if (error) throw error
}

async function markFailed(
  context: AuthContext,
  draftId: string,
  failureCode: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_action_drafts')
    .update({ status: 'FAILED', failure_code: failureCode.slice(0, 120) })
    .eq('id', draftId)
    .eq('tenant_id', context.tenantId)
    .eq('owner_user_id', context.userId)
    .eq('status', 'EXECUTING')
  if (error) throw error
}

function failureCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{0,119}$/.test(error.message)) {
    return error.message
  }
  return 'HERA_ACTION_FAILED'
}

export async function confirmActionDraft(
  context: AuthContext,
  input: ConfirmActionDraftInput,
  dependencies: HeRaActionDraftDependencies = {},
): Promise<ActionResult> {
  const draft = await (dependencies.claimDraft ?? claimDraft)(
    context,
    input.draftId,
    input.expectedVersion,
  )
  if (!draft || new Date(draft.expiresAt).getTime() <= Date.now()) {
    throw new HeRaActionDraftError('DRAFT_NOT_CONFIRMABLE')
  }

  try {
    const result = await (dependencies.executeAction ?? executeAction)(context, draft)
    await (dependencies.markSucceeded ?? markSucceeded)(context, draft.id)
    return result
  } catch (error) {
    await (dependencies.markFailed ?? markFailed)(context, draft.id, failureCode(error))
    throw error
  }
}
