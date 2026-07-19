import type { Json } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import { createPersonalReminder } from '@/lib/reminders/reminder-service'
import { updateEmployeeAddress } from '@/lib/employees/employee-service'
import { applyTimelineMutation } from '@/lib/employment/employment-detail-service'
import { updatePlacement } from '@/lib/organization/management-service'
import { createClient } from '@/lib/supabase/server'
import {
  addressChangeDraftSchema,
  employmentTimelineDraftSchema,
  placementChangeDraftSchema,
  reminderDraftSchema,
} from './schemas'
import type { AddressInput } from '@/lib/employees/schemas'
import type { TimelineMutationInput } from '@/lib/employment/detail-schemas'
import type { PlacementUpdateInput } from '@/lib/organization/schemas'

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
  createPersonalReminder?: (input: { title: string; remindAt: string; description?: string }) => Promise<string>
  updateEmployeeAddress?: (employeeId: string, addressId: string, input: AddressInput, expectedUpdatedAt?: string) => Promise<string | void>
  applyTimelineMutation?: (employmentId: string, input: TimelineMutationInput) => Promise<string>
  updatePlacement?: (placementId: string, input: PlacementUpdateInput, expectedUpdatedAt?: string) => Promise<string | void>
  cancelDraft?: (context: AuthContext, draftId: string) => Promise<boolean>
}

async function cancelDraft(context: AuthContext, draftId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_action_drafts')
    .update({ status: 'CANCELLED' })
    .eq('id', draftId)
    .eq('tenant_id', context.tenantId)
    .eq('owner_user_id', context.userId)
    .eq('status', 'AWAITING_CONFIRMATION')
    .select('id')
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function cancelActionDraft(
  context: AuthContext,
  draftId: string,
  dependencies: Pick<HeRaActionDraftDependencies, 'cancelDraft'> = {},
): Promise<void> {
  const cancelled = await (dependencies.cancelDraft ?? cancelDraft)(context, draftId)
  if (!cancelled) throw new HeRaActionDraftError('DRAFT_NOT_CONFIRMABLE')
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

async function executeAction(
  _context: AuthContext,
  draft: ClaimedActionDraft,
  dependencies: HeRaActionDraftDependencies,
): Promise<ActionResult> {
  if (draft.actionType === 'PERSONAL_REMINDER') {
    const payload = reminderDraftSchema.parse(draft.payload)
    return { entityId: await (dependencies.createPersonalReminder ?? createPersonalReminder)(payload) }
  }
  if (draft.actionType === 'EMPLOYEE_ADDRESS_CHANGE') {
    const payload = addressChangeDraftSchema.parse(draft.payload)
    const result = await (dependencies.updateEmployeeAddress ?? updateEmployeeAddress)(
      payload.employeeId, payload.addressId, payload.input, payload.expectedUpdatedAt,
    )
    return { entityId: result ?? payload.addressId }
  }
  if (draft.actionType === 'EMPLOYMENT_SALARY_CHANGE' || draft.actionType === 'EMPLOYMENT_SCHEDULE_CHANGE') {
    const payload = employmentTimelineDraftSchema.parse(draft.payload)
    const expectedTimeline = draft.actionType === 'EMPLOYMENT_SALARY_CHANGE' ? 'SALARY' : 'SCHEDULE'
    if (payload.mutation.timeline !== expectedTimeline) {
      throw new HeRaActionDraftError('DRAFT_ACTION_NOT_SUPPORTED')
    }
    return {
      entityId: await (dependencies.applyTimelineMutation ?? applyTimelineMutation)(
        payload.employmentId, payload.mutation,
      ),
    }
  }
  if (draft.actionType === 'ORGANIZATION_PLACEMENT_CHANGE') {
    const payload = placementChangeDraftSchema.parse(draft.payload)
    const result = await (dependencies.updatePlacement ?? updatePlacement)(
      payload.placementId, payload.input, payload.expectedUpdatedAt,
    )
    return { entityId: result ?? payload.placementId }
  }
  throw new HeRaActionDraftError('DRAFT_ACTION_NOT_SUPPORTED')
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
    const result = dependencies.executeAction
      ? await dependencies.executeAction(context, draft)
      : await executeAction(context, draft, dependencies)
    await (dependencies.markSucceeded ?? markSucceeded)(context, draft.id)
    return result
  } catch (error) {
    await (dependencies.markFailed ?? markFailed)(context, draft.id, failureCode(error))
    throw error
  }
}
