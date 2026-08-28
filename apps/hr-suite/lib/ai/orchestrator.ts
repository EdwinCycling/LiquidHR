import 'server-only'

import {
  AI_PERMISSION_CODES,
  AiExecutionError,
  AiProviderError,
  type AiAuditStatus,
  type AiExecutionResult,
  type AiFeatureDefinition,
  type AiFailureCode,
  type AiInvocation,
  type AiInvocationInput,
  type AiProviderMetadata,
  type AiRuntimeDependencies,
  type AiScope,
  type AiCreditReleaseRequest,
  type BusinessAuditEvent,
  type TechnicalUsageEvent,
} from './contracts'
import { buildAiRequestFingerprint } from './invocation-repository'
import { isTerminalStatus } from './state-machine'
import { resolveHrGroupCalendarMonth } from './timezone'

type RuntimeServices = Pick<
  AiRuntimeDependencies<unknown>,
  'repository' | 'credits' | 'technicalUsage' | 'businessAudit' | 'timeZoneResolver' | 'clock'
>

function scopeFromInput(input: AiInvocationInput): AiScope {
  if (!input.authContext.tenantId || !input.authContext.hrGroupId) throw new AiExecutionError('UNAUTHORIZED')
  return {
    tenantId: input.authContext.tenantId,
    hrGroupId: input.authContext.hrGroupId,
    administrationId: input.authContext.administrationId,
  }
}

function isoNow(services: Pick<AiRuntimeDependencies<unknown>, 'clock'>): string {
  const now = services.clock.now()
  if (Number.isNaN(now.valueOf())) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return now.toISOString()
}

function asAiError(error: unknown, fallback: AiFailureCode = 'INTERNAL_CONFIGURATION_ERROR'): AiExecutionError {
  return error instanceof AiExecutionError ? error : new AiExecutionError(fallback)
}

function gateFailure(error: unknown): AiFailureCode {
  const candidate = asAiError(error).code
  const gateCodes: readonly AiFailureCode[] = [
    'UNAUTHORIZED',
    'FEATURE_UNAVAILABLE',
    'FEATURE_NOT_ENTITLED',
    'AI_DISABLED',
    'QUOTA_REACHED',
    'CREDITS_EXHAUSTED',
    'CREDITS_UNAVAILABLE',
    'INTERNAL_CONFIGURATION_ERROR',
  ]
  return gateCodes.includes(candidate) ? candidate : 'INTERNAL_CONFIGURATION_ERROR'
}

function creditFailure(error: unknown): AiFailureCode {
  const candidate = asAiError(error, 'CREDITS_UNAVAILABLE').code
  return candidate === 'CREDITS_EXHAUSTED' || candidate === 'CREDITS_UNAVAILABLE'
    ? candidate
    : 'CREDITS_UNAVAILABLE'
}

function providerFailure(error: unknown): { code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_FAILED'; metadata: AiProviderMetadata | null } {
  if (error instanceof AiProviderError) {
    const code = error.code === 'PROVIDER_UNAVAILABLE' ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_FAILED'
    return { code, metadata: error.providerMetadata }
  }
  if (error instanceof AiExecutionError && (error.code === 'PROVIDER_UNAVAILABLE' || error.code === 'PROVIDER_FAILED')) {
    return { code: error.code, metadata: null }
  }
  return { code: 'PROVIDER_FAILED', metadata: null }
}

function validateInput(input: AiInvocationInput): void {
  if (input.idempotencyKey.trim().length === 0 || input.idempotencyKey.length > 200) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  if (input.businessObject.type.trim().length === 0 || input.businessObject.id.trim().length === 0) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  if (!input.businessPermissionCode || input.businessPermissionCode.trim().length === 0) {
    throw new AiExecutionError('UNAUTHORIZED')
  }
}

function assertInitialAuthorization(input: AiInvocationInput): void {
  if (!input.authContext.permissions.includes(AI_PERMISSION_CODES.use)) throw new AiExecutionError('UNAUTHORIZED')
  if (!input.businessPermissionCode || (!input.businessPermissionVerified && !input.authContext.permissions.includes(input.businessPermissionCode))) {
    throw new AiExecutionError('UNAUTHORIZED')
  }
}

function featureIsExecutable(feature: AiFeatureDefinition): boolean {
  return feature.productStatus === 'AVAILABLE' || feature.productStatus === 'INTERNAL_TEST'
}

function auditEvent(invocation: AiInvocation, status: AiAuditStatus, failureCode: AiFailureCode | null, recordedAt: string): BusinessAuditEvent {
  return {
    invocationId: invocation.id,
    scope: invocation.scope,
    actorUserId: invocation.actorUserId,
    actorEmployeeId: invocation.actorEmployeeId,
    featureCode: invocation.featureCode,
    businessObject: invocation.businessObject,
    action: 'AI_INVOCATION',
    qualityProfile: invocation.qualityProfile,
    writingStyle: invocation.writingStyle,
    reservedCredits: invocation.reservedCredits,
    chargedCredits: invocation.chargedCredits,
    status,
    failureCode,
    correlationId: invocation.correlationId,
    configVersion: invocation.configVersion,
    promptTemplateVersion: invocation.promptTemplateVersion,
    recordedAt,
  }
}

async function recordAudit(invocation: AiInvocation, status: AiAuditStatus, failureCode: AiFailureCode | null, services: RuntimeServices): Promise<void> {
  await services.businessAudit.record(auditEvent(invocation, status, failureCode, isoNow(services)))
}

function technicalEvent(
  invocation: AiInvocation,
  outcome: TechnicalUsageEvent['outcome'],
  providerMetadata: AiProviderMetadata | null,
  latencyMs: number,
  recordedAt: string,
): TechnicalUsageEvent {
  if (!invocation.qualityProfile) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return {
    invocationId: invocation.id,
    scope: invocation.scope,
    actorUserId: invocation.actorUserId,
    featureCode: invocation.featureCode,
    qualityProfile: invocation.qualityProfile,
    outcome,
    providerMetadata,
    latencyMs,
    correlationId: invocation.correlationId,
    configVersion: invocation.configVersion,
    promptTemplateVersion: invocation.promptTemplateVersion,
    recordedAt,
  }
}

async function releaseAndFail(
  invocation: AiInvocation,
  failureCode: AiFailureCode,
  reservation: { reservationId: string; invocationId: string; chargeReference: string; units: number },
  releaseReason: AiCreditReleaseRequest['reason'],
  services: RuntimeServices,
  options: {
    resultStatus: 'FAILED' | 'INVALID'
    providerMetadata: AiProviderMetadata | null
    latencyMs: number | null
    technicalOutcome: TechnicalUsageEvent['outcome'] | null
  },
): Promise<never> {
  const releasing = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: invocation.executionStatus,
    nextStatus: 'RELEASING',
    patch: {
      providerMetadata: options.providerMetadata,
      latencyMs: options.latencyMs,
    },
  })

  let finalFailure = failureCode
  if (options.technicalOutcome && options.latencyMs !== null) {
    try {
      await services.technicalUsage.record(technicalEvent(
        releasing,
        options.technicalOutcome,
        options.providerMetadata,
        options.latencyMs,
        isoNow(services),
      ))
    } catch {
      finalFailure = 'INTERNAL_CONFIGURATION_ERROR'
    }
  }

  try {
    await services.credits.release({ reservation, reason: releaseReason })
  } catch {
    finalFailure = 'CREDITS_UNAVAILABLE'
  }

  const failed = await services.repository.transition({
    invocationId: releasing.id,
    expectedStatus: 'RELEASING',
    nextStatus: 'FAILED',
    patch: {
      resultStatus: options.resultStatus,
      chargedCredits: 0,
      failureCode: finalFailure,
      finishedAt: isoNow(services),
      providerMetadata: options.providerMetadata,
      latencyMs: options.latencyMs,
    },
  })
  await recordAudit(failed, 'FAILED', finalFailure, services)
  throw new AiExecutionError(finalFailure)
}

async function reject(
  invocation: AiInvocation,
  code: AiFailureCode,
  services: RuntimeServices,
  qualityProfile = invocation.qualityProfile,
): Promise<never> {
  const rejected = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: invocation.executionStatus,
    nextStatus: 'REJECTED',
    patch: {
      qualityProfile,
      resultStatus: 'NOT_AVAILABLE',
      failureCode: code,
      finishedAt: isoNow(services),
    },
  })
  await recordAudit(rejected, 'REJECTED', code, services)
  throw new AiExecutionError(code)
}

function sameBusinessObject(left: { type: string; id: string }, right: { type: string; id: string }): boolean {
  return left.type === right.type && left.id === right.id
}

export async function runAiInvocation<T>(input: AiInvocationInput, dependencies: AiRuntimeDependencies<T>): Promise<AiExecutionResult<T>> {
  validateInput(input)
  assertInitialAuthorization(input)

  const feature = dependencies.registry.get(input.featureCode)
  if (!feature || !featureIsExecutable(feature)) throw new AiExecutionError('FEATURE_UNAVAILABLE')

  const scope = scopeFromInput(input)
  const createdAt = isoNow(dependencies)
  const invocationInput = {
    id: dependencies.createId(),
    scope,
    actorUserId: input.authContext.userId,
    actorEmployeeId: input.authContext.employeeId,
    featureCode: input.featureCode,
    businessObject: input.businessObject,
    businessPermissionCode: input.businessPermissionCode,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: buildAiRequestFingerprint(input),
    correlationId: input.correlationId ?? dependencies.createId(),
    configVersion: feature.configVersion,
    promptTemplateVersion: feature.promptTemplateVersion,
    writingStyle: input.writingStyle ?? null,
    feedbackOutcome: null,
    createdAt,
  } as const

  const created = await dependencies.repository.createOrGet(invocationInput)
  if (!created.created) {
    if (isTerminalStatus(created.invocation.executionStatus)) return { kind: 'DUPLICATE', invocation: created.invocation, replayed: true }
    throw new AiExecutionError('DUPLICATE_IN_FLIGHT')
  }

  let invocation = created.invocation
  const services: RuntimeServices = dependencies

  let gates
  try {
    gates = await dependencies.governance.resolve({
      scope,
      actorUserId: input.authContext.userId,
      feature,
      requestedQualityProfile: input.qualityProfile,
    })
  } catch (error) {
    return reject(invocation, gateFailure(error), services)
  }

  if (!gates.overallEnabled) return reject(invocation, 'AI_DISABLED', services)
  if (!gates.featureEnabled) return reject(invocation, 'FEATURE_UNAVAILABLE', services)
  if (!gates.entitled) return reject(invocation, 'FEATURE_NOT_ENTITLED', services)
  if (!gates.userQuota.allowed) return reject(invocation, 'QUOTA_REACHED', services)
  if (!feature.permittedQualityProfiles.includes(gates.qualityProfile)) return reject(invocation, 'INTERNAL_CONFIGURATION_ERROR', services)
  if (input.writingStyle && !feature.supportsWritingStyle) return reject(invocation, 'FEATURE_UNAVAILABLE', services)

  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'RECEIVED',
    nextStatus: 'AUTHORIZED',
    patch: { qualityProfile: gates.qualityProfile },
  })

  let month: string
  try {
    month = await resolveHrGroupCalendarMonth(scope, dependencies.clock.now(), dependencies.timeZoneResolver)
  } catch (error) {
    return reject(invocation, gateFailure(error), services, gates.qualityProfile)
  }

  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'AUTHORIZED',
    nextStatus: 'RESERVING',
  })

  const chargeReference = feature.chargeReferenceByProfile[gates.qualityProfile]
  if (!chargeReference) return reject(invocation, 'INTERNAL_CONFIGURATION_ERROR', services, gates.qualityProfile)

  let reservation
  try {
    await dependencies.credits.ensureMonthlyAllowance(scope, month)
    reservation = await dependencies.credits.reserve({
      scope,
      invocationId: invocation.id,
      actorUserId: input.authContext.userId,
      featureCode: feature.featureCode,
      chargeReference,
      month,
      idempotencyKey: input.idempotencyKey,
    })
  } catch (error) {
    return reject(invocation, creditFailure(error), services, gates.qualityProfile)
  }

  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'RESERVING',
    nextStatus: 'CONTEXT_LOADING',
    patch: { reservedCredits: reservation.units },
  })

  let authorizedContext
  try {
    authorizedContext = await dependencies.contextLoader.load({
      authContext: input.authContext,
      scope,
      feature,
      businessObject: input.businessObject,
    })
    if (!sameBusinessObject(authorizedContext.source, input.businessObject)) {
      throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    }
  } catch (error) {
    return releaseAndFail(
      invocation,
      asAiError(error).code,
      reservation,
      'CONTEXT_FAILED',
      services,
      { resultStatus: 'FAILED', providerMetadata: null, latencyMs: null, technicalOutcome: null },
    )
  }

  const startedAt = isoNow(services)
  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'CONTEXT_LOADING',
    nextStatus: 'EXECUTING',
    patch: { startedAt },
  })

  const providerStartedAt = dependencies.clock.now().valueOf()
  let providerResponse
  try {
    providerResponse = await dependencies.provider.execute({
      invocationId: invocation.id,
      featureCode: feature.featureCode,
      qualityProfile: gates.qualityProfile,
      writingStyle: input.writingStyle ?? null,
      configVersion: feature.configVersion,
      promptTemplateVersion: feature.promptTemplateVersion,
      technicalLimits: feature.technicalLimits,
      authorizedContext,
      providerMapping: feature.providerMappingByProfile[gates.qualityProfile],
    })
  } catch (error) {
    const provider = providerFailure(error)
    const latencyMs = Math.max(0, dependencies.clock.now().valueOf() - providerStartedAt)
    return releaseAndFail(
      invocation,
      provider.code,
      reservation,
      provider.code,
      services,
      { resultStatus: 'FAILED', providerMetadata: provider.metadata, latencyMs, technicalOutcome: provider.code },
    )
  }

  const latencyMs = Math.max(0, dependencies.clock.now().valueOf() - providerStartedAt)
  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'EXECUTING',
    nextStatus: 'VALIDATING',
    patch: { providerMetadata: providerResponse.metadata, latencyMs },
  })

  let output: T
  try {
    output = dependencies.validator.validate(providerResponse.output)
  } catch {
    return releaseAndFail(
      invocation,
      'INVALID_RESULT',
      reservation,
      'INVALID_RESULT',
      services,
      { resultStatus: 'INVALID', providerMetadata: providerResponse.metadata, latencyMs, technicalOutcome: 'INVALID_RESULT' },
    )
  }

  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'VALIDATING',
    nextStatus: 'SETTLING',
    patch: { resultStatus: 'VALIDATED' },
  })

  try {
    await dependencies.technicalUsage.record(technicalEvent(
      invocation,
      'SUCCEEDED',
      providerResponse.metadata,
      latencyMs,
      isoNow(services),
    ))
  } catch {
    return releaseAndFail(
      invocation,
      'INTERNAL_CONFIGURATION_ERROR',
      reservation,
      'INTERNAL_FAILURE',
      services,
      { resultStatus: 'FAILED', providerMetadata: providerResponse.metadata, latencyMs, technicalOutcome: null },
    )
  }

  try {
    await dependencies.credits.settle({ reservation, outcome: 'SUCCEEDED' })
  } catch {
    return releaseAndFail(
      invocation,
      'CREDITS_UNAVAILABLE',
      reservation,
      'INTERNAL_FAILURE',
      services,
      { resultStatus: 'FAILED', providerMetadata: providerResponse.metadata, latencyMs, technicalOutcome: null },
    )
  }

  invocation = await services.repository.transition({
    invocationId: invocation.id,
    expectedStatus: 'SETTLING',
    nextStatus: 'SUCCEEDED',
    patch: {
      chargedCredits: reservation.units,
      finishedAt: isoNow(services),
    },
  })
  await recordAudit(invocation, 'SUCCEEDED', null, services)
  return { kind: 'SUCCEEDED', invocation, output, replayed: false }
}
