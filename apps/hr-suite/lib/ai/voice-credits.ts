import 'server-only'

import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { AiExecutionError } from './contracts'
import { getAiGroupSettingsForContext } from './settings-service'
import { resolveHrGroupCalendarMonth } from './timezone'

export const AI_VOICE_TERMINATION_REASONS = ['NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED'] as const
export type AiVoiceTerminationReason = (typeof AI_VOICE_TERMINATION_REASONS)[number]
export type AiVoiceContextType = 'EMPLOYEE' | 'TEAM'
export type AiVoiceSessionStatus = 'ENDED' | 'FAILED'

export interface FinalizedAiVoiceSession {
  durationSeconds: number
  billableVoiceUnits: number
  voiceCredits: number
  finalized: boolean
}

type RpcError = { message?: string; code?: string }

function mapFinalizeError(error: RpcError): AiExecutionError {
  const message = error.message ?? ''
  if (message.includes('AI_VOICE_SESSION_NOT_FOUND')) return new AiExecutionError('UNAUTHORIZED')
  if (message.includes('AI_VOICE_FINALIZE_INPUT_INVALID') || message.includes('AI_CREDIT_MONTH_INVALID')) return new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  if (message.includes('AI_CREDIT_QUOTA_EXHAUSTED')) return new AiExecutionError('QUOTA_REACHED')
  if (message.includes('AI_CREDITS_EXHAUSTED')) return new AiExecutionError('CREDITS_EXHAUSTED')
  if (message.includes('AI_CREDIT_CHARGE_NOT_CONFIGURED') || message.includes('AI_CREDIT_QUOTA_UNAVAILABLE')) return new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return new AiExecutionError('CREDITS_UNAVAILABLE')
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value
}

export async function finalizeAiVoiceSession(input: {
  context: AuthContext
  contextType: AiVoiceContextType
  sessionId: string
  status: AiVoiceSessionStatus
  toolCallCount: number
  terminationReason: AiVoiceTerminationReason
}): Promise<FinalizedAiVoiceSession> {
  if (!Number.isInteger(input.toolCallCount) || input.toolCallCount < 0 || input.toolCallCount > 1000) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }

  const settings = await getAiGroupSettingsForContext(input.context)
  if (!settings.aiEnabled || !settings.voiceEnabled) throw new AiExecutionError('FEATURE_UNAVAILABLE')
  const month = await resolveHrGroupCalendarMonth(
    { tenantId: input.context.tenantId, hrGroupId: requireHrGroupId(input.context), administrationId: input.context.administrationId },
    new Date(),
  )

  const { data, error } = await createAdminClient().rpc('finalize_ai_voice_session', {
    requested_tenant_id: input.context.tenantId,
    requested_hr_group_id: requireHrGroupId(input.context),
    requested_actor_user_id: input.context.userId,
    requested_context_type: input.contextType,
    requested_session_id: input.sessionId,
    requested_status: input.status,
    requested_tool_call_count: input.toolCallCount,
    requested_max_duration_seconds: settings.maxVoiceSessionSeconds,
    requested_month: month,
    requested_termination_reason: input.terminationReason,
  })
  if (error) throw mapFinalizeError(error)
  const row = data?.[0]
  if (!row) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return {
    durationSeconds: nonNegativeInteger(row.duration_seconds),
    billableVoiceUnits: nonNegativeInteger(row.billable_voice_units),
    voiceCredits: nonNegativeInteger(row.voice_credits),
    finalized: row.finalized === true,
  }
}
