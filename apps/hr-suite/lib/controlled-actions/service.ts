import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Json } from '@scope/db'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import type { Locale } from '@/lib/i18n/config'
import { getTranslator } from '@/lib/i18n/server'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createTalentGoalCheckIn, authorizeTalentGoalCheckIn, listMyTalentGoalCheckIns, listTalentGoalCheckIns, TalentCheckInError } from '@/lib/talent/check-in-service'
import { talentCheckInCreateSchema } from '@/lib/talent/check-in-schemas'
import { authorizeTalentGoalCreate, createTalentGoal, getTalentGoal, TalentGoalError } from '@/lib/talent/goal-service'
import { talentGoalCreateSchema } from '@/lib/talent/goal-schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const controlledActionPayloadSchemas = {
  'talent.development-goal.create': talentGoalCreateSchema,
  'talent.goal-check-in.create': z.object({
    goalId: z.string().uuid(),
    input: talentCheckInCreateSchema,
  }).strict(),
} as const

export type ControlledActionId = keyof typeof controlledActionPayloadSchemas
export type ControlledActionType = 'TALENT_DEVELOPMENT_GOAL_CREATE' | 'TALENT_GOAL_CHECK_IN_CREATE'
export type ControlledActionChannel = 'HERA' | 'LOCAL_MCP'
export type ControlledActionStatus = 'AWAITING_CONFIRMATION' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

export interface ControlledActionDraft {
  id: string
  tenantId: string
  conversationId: string
  ownerUserId: string
  actionId: ControlledActionId
  actionType: ControlledActionType
  toolName: string
  payload: Json
  summary: string
  status: ControlledActionStatus
  idempotencyKey: string
  expiresAt: string
  confirmedAt: string | null
  executedAt: string | null
  failureCode: string | null
  version: number
  controlPayload: Json
}

export interface ControlledActionPreview {
  actionId: ControlledActionId
  summary: string
  subject: 'self' | 'authorized-employee'
  changes: Json
}

export interface ControlledActionResult {
  draft: ControlledActionDraft
  preview: ControlledActionPreview | null
  readback: Json | null
}

export class ControlledActionError extends Error {
  constructor(
    readonly code:
      | 'CONTROLLED_ACTION_INPUT_INVALID'
      | 'CONTROLLED_ACTION_NOT_FOUND'
      | 'CONTROLLED_ACTION_NOT_SUPPORTED'
      | 'CONTROLLED_ACTION_CONFLICT'
      | 'CONTROLLED_ACTION_PREVIEW_STALE'
      | 'CONTROLLED_ACTION_EXPIRED'
      | 'CONTROLLED_ACTION_NOT_CONFIRMABLE'
      | 'CONTROLLED_ACTION_NOT_EXECUTABLE'
      | 'CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN'
      | 'CONTROLLED_ACTION_EXECUTION_FAILED'
      | 'CONTROLLED_ACTION_READBACK_UNAVAILABLE'
      | 'CONTROLLED_ACTION_STORAGE_UNAVAILABLE',
    readonly status = 409,
  ) {
    super(code)
    this.name = 'ControlledActionError'
  }
}

export interface AuthorizedPreview {
  actionId: ControlledActionId
  actionType: ControlledActionType
  toolName: string
  payload: Json
  summary: string
  preview: ControlledActionPreview
}

export interface ControlledDraftInsert {
  conversationId: string
  actionId: ControlledActionId
  actionType: ControlledActionType
  toolName: string
  payload: Json
  summary: string
  idempotencyKey: string
  expiresAt: string
  controlPayload: Json
}

export interface ControlledActionStorage {
  findByKey(context: AuthContext, idempotencyKey: string): Promise<ControlledActionDraft | null>
  findById(context: AuthContext, draftId: string): Promise<ControlledActionDraft | null>
  insert(context: AuthContext, input: ControlledDraftInsert): Promise<ControlledActionDraft>
  confirm(context: AuthContext, draft: ControlledActionDraft, expectedVersion: number, previewHash: string, correlationId: string): Promise<ControlledActionDraft | null>
  claim(context: AuthContext, draft: ControlledActionDraft, expectedVersion: number, previewHash: string, correlationId: string): Promise<ControlledActionDraft | null>
  cancel(context: AuthContext, draft: ControlledActionDraft, correlationId: string): Promise<ControlledActionDraft | null>
  succeed(context: AuthContext, draft: ControlledActionDraft, entityId: string, correlationId: string): Promise<ControlledActionDraft | null>
  fail(context: AuthContext, draft: ControlledActionDraft, failureCode: string, correlationId: string): Promise<ControlledActionDraft | null>
}

export interface ControlledActionDomain {
  preview(context: AuthContext, actionId: ControlledActionId, payload: unknown, locale: Locale): Promise<AuthorizedPreview>
  execute(context: AuthContext, actionId: ControlledActionId, payload: Json): Promise<string>
  readback(context: AuthContext, actionId: ControlledActionId, payload: Json, entityId: string): Promise<Json>
}

export interface ControlledActionServiceDependencies {
  storage?: ControlledActionStorage
  domain?: ControlledActionDomain
  now?: () => Date
  newId?: () => string
}

type ControlPayload = Record<string, Json>

function isRecord(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function controlPayloadOf(value: Json): ControlPayload {
  if (!isRecord(value)) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 500)
  return value
}

function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(toJson)
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]))
  }
  throw new ControlledActionError('CONTROLLED_ACTION_INPUT_INVALID', 400)
}

function actionTypeFor(actionId: ControlledActionId): ControlledActionType {
  return actionId === 'talent.development-goal.create'
    ? 'TALENT_DEVELOPMENT_GOAL_CREATE'
    : 'TALENT_GOAL_CHECK_IN_CREATE'
}

function toolNameFor(actionId: ControlledActionId): string {
  return actionId === 'talent.development-goal.create'
    ? 'draft_talent_development_goal'
    : 'draft_talent_goal_check_in'
}

export function isControlledActionType(value: string): value is ControlledActionType {
  return value === 'TALENT_DEVELOPMENT_GOAL_CREATE' || value === 'TALENT_GOAL_CHECK_IN_CREATE'
}

export function isControlledActionId(value: string): value is ControlledActionId {
  return Object.hasOwn(controlledActionPayloadSchemas, value)
}

function isActionId(value: string): value is ControlledActionId {
  return isControlledActionId(value)
}

function bindAuthorization(context: AuthContext): Record<string, Json> {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    employeeId: context.employeeId,
    administrationId: context.administrationId,
    activeRoles: [...context.activeRoles].sort(),
    permissions: [...context.permissions].sort(),
  }
}

export function controlledActionPreviewHash(
  context: AuthContext,
  preview: AuthorizedPreview,
): string {
  const value = JSON.stringify({
    authorization: bindAuthorization(context),
    actionId: preview.actionId,
    payload: preview.payload,
    preview: preview.preview,
  })
  return createHash('sha256').update(value).digest('hex')
}

async function defaultPreview(context: AuthContext, actionId: ControlledActionId, rawPayload: unknown, locale: Locale): Promise<AuthorizedPreview> {
  await requireTenantModule('HERA')
  await requireTenantModule('TALENT')
  const schema = controlledActionPayloadSchemas[actionId]
  const parsed = schema.safeParse(rawPayload)
  if (!parsed.success) throw new ControlledActionError('CONTROLLED_ACTION_INPUT_INVALID', 400)

  if (actionId === 'talent.development-goal.create') {
    const input = talentGoalCreateSchema.parse(parsed.data)
    const authorized = await authorizeTalentGoalCreate(input)
    const payload = { ...input, employeeId: authorized.targetEmployeeId }
    const self = authorized.targetEmployeeId === context.employeeId
    const translate = await getTranslator('hera', locale)
    const summary = translate(self ? 'controlledGoalCreateSelf' : 'controlledGoalCreateEmployee')
    const preview: ControlledActionPreview = {
      actionId,
      summary,
      subject: self ? 'self' : 'authorized-employee',
      changes: toJson({
        title: input.title,
        description: input.description ?? null,
        capabilityId: input.capabilityId ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd ?? null,
        progressPercent: input.progressPercent,
        status: input.status,
      }),
    }
    return { actionId, actionType: actionTypeFor(actionId), toolName: toolNameFor(actionId), payload: toJson(payload), summary, preview }
  }

  const input = controlledActionPayloadSchemas['talent.goal-check-in.create'].parse(parsed.data)
  const authorized = await authorizeTalentGoalCheckIn(input.goalId, input.input)
  const self = authorized.employeeId === context.employeeId
  const translate = await getTranslator('hera', locale)
  const summary = translate('controlledCheckInCreate')
  const preview: ControlledActionPreview = {
    actionId,
    summary,
    subject: self ? 'self' : 'authorized-employee',
    changes: toJson({
      goalId: input.goalId,
      goalTitle: authorized.goalTitle,
      goalVersion: authorized.goalVersion,
      goalStatus: authorized.goalStatus,
      entryType: input.input.entryType,
      body: input.input.body,
      followUpTitle: input.input.followUpTitle ?? null,
      followUpDueOn: input.input.followUpDueOn ?? null,
    }),
  }
  return { actionId, actionType: actionTypeFor(actionId), toolName: toolNameFor(actionId), payload: toJson(input), summary, preview }
}

function failureCode(error: unknown): string {
  if (error instanceof TalentGoalError || error instanceof TalentCheckInError) return error.code.slice(0, 120)
  return 'EXECUTION_OUTCOME_UNKNOWN'
}

async function defaultExecute(_context: AuthContext, actionId: ControlledActionId, rawPayload: Json): Promise<string> {
  if (actionId === 'talent.development-goal.create') {
    return createTalentGoal(talentGoalCreateSchema.parse(rawPayload))
  }
  const input = controlledActionPayloadSchemas['talent.goal-check-in.create'].parse(rawPayload)
  return createTalentGoalCheckIn(input.goalId, input.input)
}

async function defaultReadback(context: AuthContext, actionId: ControlledActionId, rawPayload: Json, entityId: string): Promise<Json> {
  if (actionId === 'talent.development-goal.create') {
    const input = talentGoalCreateSchema.parse(rawPayload)
    const employeeId = input.employeeId ?? context.employeeId
    const mode = context.permissions.includes('talent-goal:manage')
      ? 'admin'
      : employeeId === context.employeeId
        ? 'self'
        : 'manager'
    const goal = await getTalentGoal(entityId, mode)
    return toJson({
      entityId: goal.id,
      title: goal.title,
      employeeId: goal.employee_id,
      status: goal.status,
      periodStart: goal.period_start,
      periodEnd: goal.period_end,
      progressPercent: goal.progress_percent,
    })
  }
  const input = controlledActionPayloadSchemas['talent.goal-check-in.create'].parse(rawPayload)
  const authorized = await authorizeTalentGoalCheckIn(input.goalId, input.input)
  const isSelfOnlyContext = authorized.employeeId === context.employeeId
    && !context.permissions.includes('talent-goal:read')
    && !context.permissions.includes('talent-goal:manage')
  const records = isSelfOnlyContext
    ? await listMyTalentGoalCheckIns(input.goalId)
    : await listTalentGoalCheckIns(input.goalId)
  const checkIn = records.find((item) => item.id === entityId)
  if (!checkIn) throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
  return toJson({
    entityId: checkIn.id,
    goalId: checkIn.goal_id,
    employeeId: checkIn.employee_id,
    entryType: checkIn.entry_type,
    status: checkIn.status,
    createdAt: checkIn.created_at,
    completedAt: checkIn.completed_at,
  })
}

function mapRow(row: {
  id: string
  tenant_id: string
  conversation_id: string
  owner_user_id: string
  action_type: string
  tool_name: string
  payload: Json
  summary: string
  status: string
  idempotency_key: string
  expires_at: string
  confirmed_at: string | null
  executed_at: string | null
  failure_code: string | null
  version: number
  control_payload: Json
}): ControlledActionDraft {
  if (!isControlledActionType(row.action_type)) throw new ControlledActionError('CONTROLLED_ACTION_NOT_SUPPORTED', 400)
  if (!['AWAITING_CONFIRMATION', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(row.status)) {
    throw new ControlledActionError('CONTROLLED_ACTION_NOT_SUPPORTED', 400)
  }
  const actionId = row.action_type === 'TALENT_DEVELOPMENT_GOAL_CREATE'
    ? 'talent.development-goal.create'
    : 'talent.goal-check-in.create'
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    ownerUserId: row.owner_user_id,
    actionId,
    actionType: row.action_type,
    toolName: row.tool_name,
    payload: row.payload,
    summary: row.summary,
    status: row.status as ControlledActionStatus,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    executedAt: row.executed_at,
    failureCode: row.failure_code,
    version: row.version,
    controlPayload: row.control_payload,
  }
}

function controlWith(draft: ControlledActionDraft, updates: Record<string, Json>): Json {
  return { ...controlPayloadOf(draft.controlPayload), ...updates }
}

function controlString(draft: ControlledActionDraft, key: string): string | null {
  const value = controlPayloadOf(draft.controlPayload)[key]
  return typeof value === 'string' ? value : null
}

function localeOf(draft: ControlledActionDraft): Locale {
  return controlString(draft, 'locale') === 'en' ? 'en' : 'nl'
}

function domainOf(dependencies: ControlledActionServiceDependencies): ControlledActionDomain {
  return dependencies.domain ?? {
    preview: (context, actionId, payload, locale) => defaultPreview(context, actionId, payload, locale),
    execute: defaultExecute,
    readback: defaultReadback,
  }
}

function storageOf(dependencies: ControlledActionServiceDependencies): ControlledActionStorage {
  if (dependencies.storage) return dependencies.storage
  return createSupabaseControlledActionStorage()
}

function makeDraftResult(draft: ControlledActionDraft, preview: ControlledActionPreview | null, readback: Json | null = null): ControlledActionResult {
  return { draft, preview, readback }
}

export function createControlledActionService(dependencies: ControlledActionServiceDependencies = {}) {
  const storage = storageOf(dependencies)
  const domain = domainOf(dependencies)
  const now = dependencies.now ?? (() => new Date())
  const newId = dependencies.newId ?? randomUUID

  async function authorize(context: AuthContext, draft: ControlledActionDraft): Promise<{ preview: AuthorizedPreview; hash: string }> {
    if (draft.status === 'CANCELLED' || draft.status === 'FAILED') throw new ControlledActionError('CONTROLLED_ACTION_NOT_EXECUTABLE', 409)
    const preview = await domain.preview(context, draft.actionId, draft.payload, localeOf(draft))
    const hash = controlledActionPreviewHash(context, preview)
    if (hash !== controlString(draft, 'previewHash')) throw new ControlledActionError('CONTROLLED_ACTION_PREVIEW_STALE', 409)
    return { preview, hash }
  }

  async function load(context: AuthContext, draftId: string): Promise<ControlledActionDraft> {
    const draft = await storage.findById(context, draftId)
    if (!draft) throw new ControlledActionError('CONTROLLED_ACTION_NOT_FOUND', 404)
    return draft
  }

  function correlationIdFor(draft: ControlledActionDraft): string {
    return controlString(draft, 'correlationId') ?? newId()
  }

  async function prepare(
    context: AuthContext,
    input: { conversationId: string; actionId: ControlledActionId; payload: unknown; idempotencyKey: string; channel: ControlledActionChannel; locale?: Locale },
  ): Promise<ControlledActionResult> {
    if (!isActionId(input.actionId) || !z.string().uuid().safeParse(input.idempotencyKey).success) {
      throw new ControlledActionError('CONTROLLED_ACTION_INPUT_INVALID', 400)
    }
    const locale = input.locale ?? 'nl'
    const authorized = await domain.preview(context, input.actionId, input.payload, locale)
    const previewHash = controlledActionPreviewHash(context, authorized)
    const idempotencyExisting = await storage.findByKey(context, input.idempotencyKey)
    if (idempotencyExisting) {
      if (idempotencyExisting.actionId !== input.actionId
        || idempotencyExisting.conversationId !== input.conversationId
        || JSON.stringify(idempotencyExisting.payload) !== JSON.stringify(authorized.payload)) {
        throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)
      }
      if (controlString(idempotencyExisting, 'previewHash') !== previewHash) {
        throw new ControlledActionError('CONTROLLED_ACTION_PREVIEW_STALE', 409)
      }
      return makeDraftResult(idempotencyExisting, authorized.preview)
    }

    const correlationId = newId()
    const expiresAt = new Date(now().getTime() + 15 * 60_000).toISOString()
    let draft: ControlledActionDraft
    try {
      draft = await storage.insert(context, {
        conversationId: input.conversationId,
        actionId: input.actionId,
        actionType: authorized.actionType,
        toolName: authorized.toolName,
        payload: authorized.payload,
        summary: authorized.summary,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
        controlPayload: toJson({
          preview: authorized.preview,
          previewHash,
          correlationId,
          actorUserId: context.userId,
          sourceChannel: input.channel,
          locale,
          newValue: authorized.preview.changes,
          oldValue: null,
        }),
      })
    } catch {
      const raced = await storage.findByKey(context, input.idempotencyKey)
      if (!raced) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      if (raced.actionId !== input.actionId
        || raced.conversationId !== input.conversationId
        || JSON.stringify(raced.payload) !== JSON.stringify(authorized.payload)) {
        throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)
      }
      draft = raced
    }
    return makeDraftResult(draft, authorized.preview)
  }

  async function preview(context: AuthContext, draftId: string): Promise<ControlledActionResult> {
    const draft = await load(context, draftId)
    if (new Date(draft.expiresAt).getTime() <= now().getTime()) throw new ControlledActionError('CONTROLLED_ACTION_EXPIRED', 409)
    const authorized = await authorize(context, draft)
    return makeDraftResult(draft, authorized.preview.preview)
  }

  async function confirm(context: AuthContext, input: { draftId: string; expectedVersion: number; expectedPreviewHash: string }): Promise<ControlledActionResult> {
    const draft = await load(context, input.draftId)
    if (new Date(draft.expiresAt).getTime() <= now().getTime()) throw new ControlledActionError('CONTROLLED_ACTION_EXPIRED', 409)
    const authorized = await authorize(context, draft)
    if (input.expectedPreviewHash !== authorized.hash) throw new ControlledActionError('CONTROLLED_ACTION_PREVIEW_STALE', 409)
    if (draft.status === 'AWAITING_CONFIRMATION' && draft.confirmedAt && controlString(draft, 'confirmedFromVersion') === String(input.expectedVersion)) {
      return makeDraftResult(draft, authorized.preview.preview)
    }
    if (draft.status !== 'AWAITING_CONFIRMATION' || draft.confirmedAt || draft.version !== input.expectedVersion) {
      throw new ControlledActionError('CONTROLLED_ACTION_NOT_CONFIRMABLE', 409)
    }
    const confirmed = await storage.confirm(context, draft, input.expectedVersion, authorized.hash, correlationIdFor(draft))
    if (!confirmed) throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)
    return makeDraftResult(confirmed, authorized.preview.preview)
  }

  async function cancel(context: AuthContext, draftId: string): Promise<ControlledActionResult> {
    const draft = await load(context, draftId)
    if (draft.status === 'CANCELLED') return makeDraftResult(draft, null)
    if (draft.status !== 'AWAITING_CONFIRMATION') throw new ControlledActionError('CONTROLLED_ACTION_NOT_EXECUTABLE', 409)
    const cancelled = await storage.cancel(context, draft, correlationIdFor(draft))
    if (!cancelled) throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)
    return makeDraftResult(cancelled, null)
  }

  async function execute(context: AuthContext, input: { draftId: string; expectedVersion: number; expectedPreviewHash: string }): Promise<ControlledActionResult> {
    const draft = await load(context, input.draftId)
    if (draft.status === 'SUCCEEDED') {
      const authorized = await authorize(context, draft)
      const confirmedFromVersion = Number(controlString(draft, 'confirmedFromVersion'))
      const confirmedVersion = confirmedFromVersion + 1
      if (!Number.isSafeInteger(confirmedFromVersion)
        || input.expectedVersion !== confirmedVersion
        || input.expectedPreviewHash !== controlString(draft, 'confirmedPreviewHash')) {
        throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)
      }
      const entityId = controlString(draft, 'entityId')
      if (!entityId) throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
      try {
        return makeDraftResult(draft, authorized.preview.preview, await domain.readback(context, draft.actionId, draft.payload, entityId))
      } catch {
        throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
      }
    }
    if (draft.status === 'EXECUTING') throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 409)
    if (draft.status !== 'AWAITING_CONFIRMATION' || !draft.confirmedAt || draft.version !== input.expectedVersion) {
      throw new ControlledActionError('CONTROLLED_ACTION_NOT_EXECUTABLE', 409)
    }
    if (new Date(draft.expiresAt).getTime() <= now().getTime()) throw new ControlledActionError('CONTROLLED_ACTION_EXPIRED', 409)
    const authorized = await authorize(context, draft)
    if (input.expectedPreviewHash !== authorized.hash
      || controlString(draft, 'confirmedPreviewHash') !== authorized.hash) {
      throw new ControlledActionError('CONTROLLED_ACTION_PREVIEW_STALE', 409)
    }
    const claimed = await storage.claim(context, draft, input.expectedVersion, authorized.hash, correlationIdFor(draft))
    if (!claimed) throw new ControlledActionError('CONTROLLED_ACTION_CONFLICT', 409)

    let entityId: string
    try {
      entityId = await domain.execute(context, claimed.actionId, claimed.payload)
    } catch (error) {
      if (error instanceof TalentGoalError || error instanceof TalentCheckInError) {
        let failed: ControlledActionDraft | null
        try {
          failed = await storage.fail(context, claimed, failureCode(error), correlationIdFor(claimed))
        } catch {
          throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 503)
        }
        if (!failed) throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 503)
        throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_FAILED', error.status)
      }
      // The domain call may have committed before a transport error. Keep the
      // draft EXECUTING so it cannot be retried as if failure were certain.
      throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 503)
    }

    let succeeded: ControlledActionDraft | null
    try {
      succeeded = await storage.succeed(context, claimed, entityId, correlationIdFor(claimed))
    } catch {
      throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 503)
    }
    if (!succeeded) throw new ControlledActionError('CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN', 503)
    try {
      return makeDraftResult(succeeded, authorized.preview.preview, await domain.readback(context, succeeded.actionId, succeeded.payload, entityId))
    } catch {
      throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
    }
  }

  async function readback(context: AuthContext, draftId: string): Promise<ControlledActionResult> {
    const draft = await load(context, draftId)
    const authorized = await domain.preview(context, draft.actionId, draft.payload, localeOf(draft))
    const hash = controlledActionPreviewHash(context, authorized)
    if (hash !== controlString(draft, 'previewHash')) throw new ControlledActionError('CONTROLLED_ACTION_PREVIEW_STALE', 409)
    if (draft.status !== 'SUCCEEDED') return makeDraftResult(draft, authorized.preview)
    const entityId = controlString(draft, 'entityId')
    if (!entityId) throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
    try {
      return makeDraftResult(draft, authorized.preview, await domain.readback(context, draft.actionId, draft.payload, entityId))
    } catch {
      throw new ControlledActionError('CONTROLLED_ACTION_READBACK_UNAVAILABLE', 503)
    }
  }

  return { prepare, preview, confirm, cancel, execute, readback }
}

export const controlledActions = createControlledActionService()

export async function findControlledActionDraft(context: AuthContext, draftId: string): Promise<boolean> {
  const draft = await createSupabaseControlledActionStorage().findById(context, draftId)
  return Boolean(draft)
}

export async function getOrCreateLocalMcpConversation(context: AuthContext): Promise<string> {
  await requireTenantModule('HERA')
  const supabase = await createClient()
  const translate = await getTranslator('hera')
  const title = translate('localMcpActionsConversation')
  const { data: existing, error: readError } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('owner_user_id', context.userId)
    .eq('title', title)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (readError) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
  if (existing) return existing.id
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ tenant_id: context.tenantId, owner_user_id: context.userId, title })
    .select('id')
    .single()
  if (error || !data) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
  return data.id
}

function createSupabaseControlledActionStorage(): ControlledActionStorage {
  async function userClient() { return createClient() }
  function adminClient() { return createAdminClient() }
  return {
    async findByKey(context, idempotencyKey) {
      const supabase = await userClient()
      const { data, error } = await supabase.from('ai_action_drafts').select('*')
        .eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).eq('idempotency_key', idempotencyKey).maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data && isControlledActionType(data.action_type) ? mapRow(data) : null
    },
    async findById(context, draftId) {
      const supabase = await userClient()
      const { data, error } = await supabase.from('ai_action_drafts').select('*')
        .eq('id', draftId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data && isControlledActionType(data.action_type) ? mapRow(data) : null
    },
    async insert(context, input) {
      const userScoped = await userClient()
      const { data: conversation, error: conversationError } = await userScoped
        .from('ai_conversations').select('id')
        .eq('id', input.conversationId).eq('tenant_id', context.tenantId)
        .eq('owner_user_id', context.userId).maybeSingle()
      if (conversationError || !conversation) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)

      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').insert({
        tenant_id: context.tenantId,
        conversation_id: input.conversationId,
        owner_user_id: context.userId,
        action_type: input.actionType,
        tool_name: input.toolName,
        payload: input.payload,
        summary: input.summary,
        status: 'AWAITING_CONFIRMATION',
        idempotency_key: input.idempotencyKey,
        expires_at: input.expiresAt,
        version: 1,
        control_payload: input.controlPayload,
      }).select('*').single()
      if (error || !data) throw error ?? new Error('CONTROLLED_ACTION_STORAGE_UNAVAILABLE')
      return mapRow(data)
    },
    async confirm(context, draft, expectedVersion, previewHash, correlationId) {
      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').update({
        confirmed_at: new Date().toISOString(),
        version: expectedVersion + 1,
        control_payload: controlWith(draft, {
          correlationId,
          confirmedPreviewHash: previewHash,
          confirmedFromVersion: String(expectedVersion),
          sourceChannel: controlString(draft, 'sourceChannel') ?? 'HERA',
        }),
      }).eq('id', draft.id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
        .eq('status', 'AWAITING_CONFIRMATION').eq('version', expectedVersion).is('confirmed_at', null)
        .gt('expires_at', new Date().toISOString()).select('*').maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data ? mapRow(data) : null
    },
    async claim(context, draft, expectedVersion, previewHash, correlationId) {
      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').update({
        status: 'EXECUTING',
        version: expectedVersion + 1,
        control_payload: controlWith(draft, { correlationId, confirmedPreviewHash: previewHash }),
      }).eq('id', draft.id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
        .eq('status', 'AWAITING_CONFIRMATION').eq('version', expectedVersion).not('confirmed_at', 'is', null)
        .gt('expires_at', new Date().toISOString()).select('*').maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data ? mapRow(data) : null
    },
    async cancel(context, draft, correlationId) {
      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').update({
        status: 'CANCELLED',
        version: draft.version + 1,
        control_payload: controlWith(draft, { correlationId }),
      }).eq('id', draft.id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
        .eq('status', 'AWAITING_CONFIRMATION').eq('version', draft.version)
        .select('*').maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data ? mapRow(data) : null
    },
    async succeed(context, draft, entityId, correlationId) {
      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').update({
        status: 'SUCCEEDED',
        executed_at: new Date().toISOString(),
        failure_code: null,
        version: draft.version + 1,
        control_payload: controlWith(draft, { correlationId, entityId }),
      }).eq('id', draft.id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
        .eq('status', 'EXECUTING').eq('version', draft.version).select('*').maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data ? mapRow(data) : null
    },
    async fail(context, draft, failureCodeValue, correlationId) {
      const supabase = adminClient()
      const { data, error } = await supabase.from('ai_action_drafts').update({
        status: 'FAILED',
        failure_code: failureCodeValue.slice(0, 120),
        version: draft.version + 1,
        control_payload: controlWith(draft, { correlationId }),
      }).eq('id', draft.id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
        .eq('status', 'EXECUTING').eq('version', draft.version).select('*').maybeSingle()
      if (error) throw new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503)
      return data ? mapRow(data) : null
    },
  }
}
