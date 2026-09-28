import 'server-only'

import { AiExecutionError, type AiLifecycleRecoveryPort, type AiScope } from './contracts'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'

const AI_RECOVERY_BATCH_SIZE = 20
const VOICE_RECOVERY_BATCH_SIZE = 20

export class SupabaseAiLifecycleRecovery implements AiLifecycleRecoveryPort {
  async reconcile(scope: AiScope): Promise<void> {
    await reconcileAiLifecycle(scope)
  }
}

export async function reconcileAiLifecycle(scope: AiScope): Promise<void> {
  const admin = createAdminClient()
  const invocationResult = await admin.rpc('reconcile_ai_invocation_lifecycle', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
    requested_batch_size: AI_RECOVERY_BATCH_SIZE,
  })
  if (invocationResult.error) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

  const voiceResult = await admin.rpc('reconcile_expired_ai_voice_sessions', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
    requested_batch_size: VOICE_RECOVERY_BATCH_SIZE,
  })
  if (voiceResult.error) throw new AiExecutionError('CREDITS_UNAVAILABLE')
}

export async function reconcileVoiceForContext(context: AuthContext): Promise<void> {
  const scope: AiScope = {
    tenantId: context.tenantId,
    hrGroupId: requireHrGroupId(context),
    administrationId: context.administrationId,
  }
  const result = await createAdminClient().rpc('reconcile_expired_ai_voice_sessions', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
    requested_batch_size: VOICE_RECOVERY_BATCH_SIZE,
  })
  if (result.error) throw new AiExecutionError('CREDITS_UNAVAILABLE')
}
