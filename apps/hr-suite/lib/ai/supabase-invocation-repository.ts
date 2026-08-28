import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { AiExecutionError, type AiExecutionStatus, type AiInvocation, type AiInvocationPatch, type AiProviderMetadata, type AiResultStatus, type AiStateTransition, type InvocationRepository, type NewAiInvocation } from './contracts'
import { canTransition } from './state-machine'

type SupabaseInvocationRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string | null
  actor_user_id: string
  actor_employee_id: string | null
  feature_code: string
  business_object_type: string
  business_object_id: string
  business_permission_code: string | null
  idempotency_key: string
  request_fingerprint: string
  correlation_id: string
  config_version: string
  prompt_template_version: string
  quality_profile: string | null
  writing_style: string | null
  execution_status: string
  result_status: string
  feedback_outcome: string | null
  reserved_credits: number
  charged_credits: number
  provider_code: string | null
  model_family: string | null
  reasoning_profile: string | null
  provider_request_id: string | null
  provider_input_units: number | null
  provider_output_units: number | null
  latency_ms: number | null
  failure_code: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

type InvocationWrite = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string | null
  actor_user_id: string
  actor_employee_id: string | null
  feature_code: string
  business_object_type: string
  business_object_id: string
  business_permission_code: string | null
  idempotency_key: string
  request_fingerprint: string
  correlation_id: string
  config_version: string
  prompt_template_version: string
  writing_style: string | null
  feedback_outcome: string | null
  created_at: string
}

function requiredString(value: string | null): string {
  if (!value) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value
}

function executionStatus(value: string): AiExecutionStatus {
  const statuses: readonly AiExecutionStatus[] = ['RECEIVED', 'AUTHORIZED', 'RESERVING', 'CONTEXT_LOADING', 'EXECUTING', 'VALIDATING', 'SETTLING', 'RELEASING', 'SUCCEEDED', 'FAILED', 'REJECTED']
  if (!statuses.includes(value as AiExecutionStatus)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value as AiExecutionStatus
}

function resultStatus(value: string): AiResultStatus {
  const statuses: readonly AiResultStatus[] = ['PENDING', 'VALIDATED', 'NOT_AVAILABLE', 'INVALID', 'FAILED']
  if (!statuses.includes(value as AiResultStatus)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value as AiResultStatus
}

function qualityProfile(value: string | null): AiInvocation['qualityProfile'] {
  if (value === null) return null
  if (value === 'EFFICIENT' || value === 'BALANCED' || value === 'IN_DEPTH') return value
  throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
}

function writingStyle(value: string | null): AiInvocation['writingStyle'] {
  if (value === null) return null
  if (value === 'FORMAL' || value === 'PLAIN' || value === 'WARM' || value === 'DIRECT') return value
  throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
}

function failureCode(value: string | null): AiInvocation['failureCode'] {
  if (value === null) return null
  const codes: readonly AiInvocation['failureCode'][] = [
    'UNAUTHORIZED',
    'FEATURE_UNAVAILABLE',
    'FEATURE_NOT_ENTITLED',
    'AI_DISABLED',
    'QUOTA_REACHED',
    'CREDITS_EXHAUSTED',
    'CREDITS_UNAVAILABLE',
    'DUPLICATE_IN_FLIGHT',
    'DUPLICATE_COMPLETED',
    'IDEMPOTENCY_KEY_REUSED',
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_FAILED',
    'INVALID_RESULT',
    'INTERNAL_CONFIGURATION_ERROR',
  ]
  if (!codes.includes(value as AiInvocation['failureCode'])) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value as NonNullable<AiInvocation['failureCode']>
}

function providerMetadata(row: SupabaseInvocationRow): AiProviderMetadata | null {
  if (!row.provider_code && !row.model_family && !row.reasoning_profile && !row.provider_request_id) return null
  if (!row.provider_code || !row.model_family || !row.reasoning_profile) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return {
    providerCode: row.provider_code,
    modelFamily: row.model_family,
    reasoningProfile: row.reasoning_profile,
    requestId: row.provider_request_id,
    usage: row.provider_input_units === null && row.provider_output_units === null
      ? null
      : { inputUnits: row.provider_input_units, outputUnits: row.provider_output_units },
  }
}

function mapRow(row: SupabaseInvocationRow): AiInvocation {
  return {
    id: requiredString(row.id),
    scope: {
      tenantId: requiredString(row.tenant_id),
      hrGroupId: requiredString(row.hr_group_id),
      administrationId: row.administration_id,
    },
    actorUserId: requiredString(row.actor_user_id),
    actorEmployeeId: row.actor_employee_id,
    featureCode: requiredString(row.feature_code),
    businessObject: {
      type: requiredString(row.business_object_type),
      id: requiredString(row.business_object_id),
    },
    businessPermissionCode: row.business_permission_code,
    idempotencyKey: requiredString(row.idempotency_key),
    requestFingerprint: requiredString(row.request_fingerprint),
    correlationId: requiredString(row.correlation_id),
    configVersion: requiredString(row.config_version),
    promptTemplateVersion: requiredString(row.prompt_template_version),
    qualityProfile: qualityProfile(row.quality_profile),
    writingStyle: writingStyle(row.writing_style),
    executionStatus: executionStatus(requiredString(row.execution_status)),
    resultStatus: resultStatus(requiredString(row.result_status)),
    feedbackOutcome: row.feedback_outcome,
    reservedCredits: row.reserved_credits,
    chargedCredits: row.charged_credits,
    providerMetadata: providerMetadata(row),
    latencyMs: row.latency_ms,
    failureCode: failureCode(row.failure_code),
    createdAt: requiredString(row.created_at),
    updatedAt: requiredString(row.updated_at),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

function rowFromInvocation(input: NewAiInvocation): InvocationWrite {
  return {
    id: input.id,
    tenant_id: input.scope.tenantId,
    hr_group_id: input.scope.hrGroupId,
    administration_id: input.scope.administrationId,
    actor_user_id: input.actorUserId,
    actor_employee_id: input.actorEmployeeId,
    feature_code: input.featureCode,
    business_object_type: input.businessObject.type,
    business_object_id: input.businessObject.id,
    business_permission_code: input.businessPermissionCode,
    idempotency_key: input.idempotencyKey,
    request_fingerprint: input.requestFingerprint,
    correlation_id: input.correlationId,
    config_version: input.configVersion,
    prompt_template_version: input.promptTemplateVersion,
    writing_style: input.writingStyle,
    feedback_outcome: input.feedbackOutcome,
    created_at: input.createdAt,
  }
}

function providerPatch(metadata: AiProviderMetadata | null): Record<string, string | number | null> {
  return metadata
    ? {
        provider_code: metadata.providerCode,
        model_family: metadata.modelFamily,
        reasoning_profile: metadata.reasoningProfile,
        provider_request_id: metadata.requestId,
        provider_input_units: metadata.usage?.inputUnits ?? null,
        provider_output_units: metadata.usage?.outputUnits ?? null,
      }
    : {
        provider_code: null,
        model_family: null,
        reasoning_profile: null,
        provider_request_id: null,
        provider_input_units: null,
        provider_output_units: null,
      }
}

function rowPatch(patch: AiInvocationPatch): Record<string, string | number | null> {
  const values: Record<string, string | number | null> = {}
  if (patch.qualityProfile !== undefined) values.quality_profile = patch.qualityProfile
  if (patch.writingStyle !== undefined) values.writing_style = patch.writingStyle
  if (patch.resultStatus !== undefined) values.result_status = patch.resultStatus
  if (patch.feedbackOutcome !== undefined) values.feedback_outcome = patch.feedbackOutcome
  if (patch.reservedCredits !== undefined) values.reserved_credits = patch.reservedCredits
  if (patch.chargedCredits !== undefined) values.charged_credits = patch.chargedCredits
  if (patch.providerMetadata !== undefined) Object.assign(values, providerPatch(patch.providerMetadata))
  if (patch.latencyMs !== undefined) values.latency_ms = patch.latencyMs
  if (patch.failureCode !== undefined) values.failure_code = patch.failureCode
  if (patch.startedAt !== undefined) values.started_at = patch.startedAt
  if (patch.finishedAt !== undefined) values.finished_at = patch.finishedAt
  values.updated_at = patch.updatedAt ?? new Date().toISOString()
  return values
}

export class SupabaseInvocationRepository implements InvocationRepository {
  async createOrGet(input: NewAiInvocation): Promise<{ invocation: AiInvocation; created: boolean }> {
    const admin = createAdminClient()
    const existingResult = await admin
      .from('ai_invocations')
      .select('*')
      .eq('tenant_id', input.scope.tenantId)
      .eq('hr_group_id', input.scope.hrGroupId)
      .eq('actor_user_id', input.actorUserId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()

    if (existingResult.error) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    if (existingResult.data) {
      const invocation = mapRow(existingResult.data as SupabaseInvocationRow)
      if (invocation.requestFingerprint !== input.requestFingerprint) throw new AiExecutionError('IDEMPOTENCY_KEY_REUSED')
      return { invocation, created: false }
    }

    const inserted = await admin.from('ai_invocations').insert(rowFromInvocation(input)).select('*').single()
    if (!inserted.error && inserted.data) return { invocation: mapRow(inserted.data as SupabaseInvocationRow), created: true }

    if (inserted.error?.code !== '23505') throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

    const raced = await admin
      .from('ai_invocations')
      .select('*')
      .eq('tenant_id', input.scope.tenantId)
      .eq('hr_group_id', input.scope.hrGroupId)
      .eq('actor_user_id', input.actorUserId)
      .eq('idempotency_key', input.idempotencyKey)
      .single()
    if (raced.error || !raced.data) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

    const invocation = mapRow(raced.data as SupabaseInvocationRow)
    if (invocation.requestFingerprint !== input.requestFingerprint) throw new AiExecutionError('IDEMPOTENCY_KEY_REUSED')
    return { invocation, created: false }
  }

  async transition(input: AiStateTransition): Promise<AiInvocation> {
    if (!canTransition(input.expectedStatus, input.nextStatus)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

    const admin = createAdminClient()
    const updated = await admin
      .from('ai_invocations')
      .update({ ...rowPatch(input.patch ?? {}) , execution_status: input.nextStatus })
      .eq('id', input.invocationId)
      .eq('execution_status', input.expectedStatus)
      .select('*')
      .maybeSingle()

    if (updated.error || !updated.data) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    return mapRow(updated.data as SupabaseInvocationRow)
  }
}
