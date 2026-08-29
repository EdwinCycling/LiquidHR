import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { AiExecutionError, type BusinessAuditEvent, type TechnicalUsageEvent } from './contracts'

export class SupabaseTechnicalUsageSink {
  async record(event: TechnicalUsageEvent): Promise<void> {
    const metadata = event.providerMetadata
    const result = await createAdminClient().from('ai_technical_usage').insert({
      invocation_id: event.invocationId,
      tenant_id: event.scope.tenantId,
      hr_group_id: event.scope.hrGroupId,
      actor_user_id: event.actorUserId,
      feature_code: event.featureCode,
      quality_profile: event.qualityProfile,
      outcome: event.outcome,
      provider_code: metadata?.providerCode ?? null,
      model_family: metadata?.modelFamily ?? null,
      reasoning_profile: metadata?.reasoningProfile ?? null,
      provider_request_id: metadata?.requestId ?? null,
      provider_input_units: metadata?.usage?.inputUnits ?? null,
      provider_output_units: metadata?.usage?.outputUnits ?? null,
      latency_ms: event.latencyMs,
      correlation_id: event.correlationId,
      config_version: event.configVersion,
      prompt_template_version: event.promptTemplateVersion,
      recorded_at: event.recordedAt,
    })

    if (result.error && result.error.code !== '23505') throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
}

export class SupabaseBusinessAuditSink {
  async record(event: BusinessAuditEvent): Promise<void> {
    const result = await createAdminClient().from('ai_business_audit').insert({
      invocation_id: event.invocationId,
      tenant_id: event.scope.tenantId,
      hr_group_id: event.scope.hrGroupId,
      administration_id: event.scope.administrationId,
      actor_user_id: event.actorUserId,
      actor_employee_id: event.actorEmployeeId,
      feature_code: event.featureCode,
      business_object_type: event.businessObject.type,
      business_object_id: event.businessObject.id,
      action: event.action,
      quality_profile: event.qualityProfile,
      writing_style: event.writingStyle,
      reserved_credits: event.reservedCredits,
      charged_credits: event.chargedCredits,
      status: event.status,
      failure_code: event.failureCode,
      correlation_id: event.correlationId,
      config_version: event.configVersion,
      prompt_template_version: event.promptTemplateVersion,
      recorded_at: event.recordedAt,
    })

    if (result.error && result.error.code !== '23505') throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
}
