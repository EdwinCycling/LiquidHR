import 'server-only'

import { randomUUID } from 'node:crypto'
import { AuthenticationError, AuthorizationError, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { AiExecutionError, type AiExecutionResult, type AiInvocationInput, type AiRuntimeDependencies, type AuthorizedContextLoader, type BusinessAuditSink, type CreditsPort, type AiGovernancePort, type AiResultValidator, type ProviderPort, type ProviderSafetyPort, type TechnicalUsageSink, type InvocationRepository, type AiClock, type HrGroupTimeZoneResolver } from './contracts'
import { FailClosedGovernancePort } from './fail-closed-ports'
import { aiFeatureRegistry } from './feature-registry'
import { runAiInvocation } from './orchestrator'
import { SupabaseBusinessAuditSink, SupabaseTechnicalUsageSink } from './supabase-observability-sinks'
import { SupabaseInvocationRepository } from './supabase-invocation-repository'
import { SupabaseLiquidCreditsService } from './supabase-liquid-credits'
import { defaultHrGroupTimeZoneResolver } from './timezone'
import { resolveServerAiRuntimeProviders } from './provider-resolver'

export function createServerAiRuntimeDependencies<T>(input: {
  provider?: ProviderPort
  providerSafety?: ProviderSafetyPort
  contextLoader: AuthorizedContextLoader
  validator: AiResultValidator<T>
  governance?: AiGovernancePort
  credits?: CreditsPort
  repository?: InvocationRepository
  technicalUsage?: TechnicalUsageSink
  businessAudit?: BusinessAuditSink
  timeZoneResolver?: HrGroupTimeZoneResolver
  clock?: AiClock
}): AiRuntimeDependencies<T> {
  const resolved = input.provider ? null : resolveServerAiRuntimeProviders()
  const provider = input.provider ?? resolved?.provider
  const providerSafety = input.providerSafety ?? resolved?.providerSafety
  if (!provider || !providerSafety) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return {
    registry: aiFeatureRegistry,
    governance: input.governance ?? new FailClosedGovernancePort(),
    credits: input.credits ?? new SupabaseLiquidCreditsService(),
    contextLoader: input.contextLoader,
    provider,
    providerSafety,
    validator: input.validator,
    repository: input.repository ?? new SupabaseInvocationRepository(),
    technicalUsage: input.technicalUsage ?? new SupabaseTechnicalUsageSink(),
    businessAudit: input.businessAudit ?? new SupabaseBusinessAuditSink(),
    timeZoneResolver: input.timeZoneResolver ?? defaultHrGroupTimeZoneResolver,
    clock: input.clock ?? { now: () => new Date() },
    createId: randomUUID,
  }
}

export async function runAuthorizedAiInvocation<T>(
  input: Omit<AiInvocationInput, 'authContext'>,
  dependencies: AiRuntimeDependencies<T>,
): Promise<AiExecutionResult<T>> {
  let context: AuthContext
  try {
    context = await requirePermission('ai:use')
    if (input.businessPermissionCode) await requirePermission(input.businessPermissionCode)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      throw new AiExecutionError('UNAUTHORIZED')
    }
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }

  return runAiInvocation({ ...input, authContext: context, businessPermissionVerified: true }, dependencies)
}
