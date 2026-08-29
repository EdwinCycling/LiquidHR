import type { AuthContext } from '@/lib/auth/permissions'

export type AiJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly AiJsonValue[]
  | { readonly [key: string]: AiJsonValue }

export type AiQualityProfile = 'EFFICIENT' | 'BALANCED' | 'IN_DEPTH'
export type AiEdition = 'FOUNDATION' | 'PROFESSIONAL' | 'ENTERPRISE'
export type AiProductStatus = 'PLANNED' | 'INTERNAL_TEST' | 'AVAILABLE' | 'RETIRED'
export type AiAllowedResultType = 'PROPOSAL'
export type AiWritingStyle = 'FORMAL' | 'PLAIN' | 'WARM' | 'DIRECT'

export type AiExecutionStatus =
  | 'RECEIVED'
  | 'AUTHORIZED'
  | 'RESERVING'
  | 'CONTEXT_LOADING'
  | 'EXECUTING'
  | 'VALIDATING'
  | 'SETTLING'
  | 'RELEASING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'

export type AiResultStatus = 'PENDING' | 'VALIDATED' | 'NOT_AVAILABLE' | 'INVALID' | 'FAILED'
export type AiAuditStatus = 'SUCCEEDED' | 'FAILED' | 'REJECTED'

export type AiFailureCode =
  | 'UNAUTHORIZED'
  | 'FEATURE_UNAVAILABLE'
  | 'FEATURE_NOT_ENTITLED'
  | 'AI_DISABLED'
  | 'QUOTA_REACHED'
  | 'CREDITS_EXHAUSTED'
  | 'CREDITS_UNAVAILABLE'
  | 'DUPLICATE_IN_FLIGHT'
  | 'DUPLICATE_COMPLETED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_FAILED'
  | 'AI_PROVIDER_DISABLED'
  | 'AI_PROVIDER_HOURLY_LIMIT'
  | 'AI_PROVIDER_DAILY_LIMIT'
  | 'AI_PROVIDER_CONCURRENCY_LIMIT'
  | 'AI_PROVIDER_INVOCATION_LIMIT'
  | 'AI_PROVIDER_INPUT_TOO_LARGE'
  | 'AI_PROVIDER_OUTPUT_TOO_LARGE'
  | 'AI_PROVIDER_SAFETY_UNAVAILABLE'
  | 'INVALID_RESULT'
  | 'INTERNAL_CONFIGURATION_ERROR'

export const AI_PERMISSION_CODES = {
  use: 'ai:use',
  manage: 'ai:manage',
  usageRead: 'ai:usage-read',
  auditRead: 'ai:audit-read',
  creditsManage: 'ai:credits-manage',
} as const

export interface AiScope {
  tenantId: string
  hrGroupId: string
  administrationId: string | null
}

export interface AiBusinessObjectRef {
  type: string
  id: string
}

export interface AiTechnicalLimits {
  maxInputCharacters: number
  maxContextItems: number
  maxOutputCharacters: number
  timeoutMs: number
}

export interface AiProviderMapping {
  modelFamily: string
  reasoningProfile: string
  generationProfile: string
}

export interface AiFeatureDefinition {
  featureCode: string
  capabilityGroup: string
  productStatus: AiProductStatus
  minimumEdition: AiEdition
  permittedQualityProfiles: readonly AiQualityProfile[]
  defaultQualityProfile: AiQualityProfile
  chargeStrategy: 'FIXED_PER_FEATURE_AND_PROFILE'
  chargeReferenceByProfile: Readonly<Record<AiQualityProfile, string>>
  providerMappingByProfile: Readonly<Record<AiQualityProfile, AiProviderMapping>>
  technicalLimits: AiTechnicalLimits
  supportsWritingStyle: boolean
  allowedResultType: AiAllowedResultType
  promptTemplateVersion: string
  configVersion: string
}

export interface AiFeatureRegistry {
  get(featureCode: string): AiFeatureDefinition | null
}

export interface AiInvocationInput {
  authContext: AuthContext
  featureCode: string
  businessObject: AiBusinessObjectRef
  idempotencyKey: string
  businessPermissionCode: string | null
  /** Alleen de server-entrypoint mag dit na requirePermission op true zetten. */
  businessPermissionVerified?: boolean
  qualityProfile?: AiQualityProfile
  writingStyle?: AiWritingStyle | null
  correlationId?: string
  /** Optionele caller-cancellation; de provider voegt daarnaast zijn eigen timeout toe. */
  signal?: AbortSignal
}

export interface AiInvocation {
  id: string
  scope: AiScope
  actorUserId: string
  actorEmployeeId: string | null
  featureCode: string
  businessObject: AiBusinessObjectRef
  businessPermissionCode: string | null
  idempotencyKey: string
  requestFingerprint: string
  correlationId: string
  configVersion: string
  promptTemplateVersion: string
  qualityProfile: AiQualityProfile | null
  writingStyle: AiWritingStyle | null
  executionStatus: AiExecutionStatus
  resultStatus: AiResultStatus
  feedbackOutcome: string | null
  reservedCredits: number
  chargedCredits: number
  providerMetadata: AiProviderMetadata | null
  latencyMs: number | null
  failureCode: AiFailureCode | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface NewAiInvocation {
  id: string
  scope: AiScope
  actorUserId: string
  actorEmployeeId: string | null
  featureCode: string
  businessObject: AiBusinessObjectRef
  businessPermissionCode: string | null
  idempotencyKey: string
  requestFingerprint: string
  correlationId: string
  configVersion: string
  promptTemplateVersion: string
  writingStyle: AiWritingStyle | null
  feedbackOutcome: string | null
  createdAt: string
}

export interface AiInvocationPatch {
  qualityProfile?: AiQualityProfile | null
  writingStyle?: AiWritingStyle | null
  feedbackOutcome?: string | null
  resultStatus?: AiResultStatus
  reservedCredits?: number
  chargedCredits?: number
  providerMetadata?: AiProviderMetadata | null
  latencyMs?: number | null
  failureCode?: AiFailureCode | null
  startedAt?: string | null
  finishedAt?: string | null
  updatedAt?: string
}

export interface AiStateTransition {
  invocationId: string
  expectedStatus: AiExecutionStatus
  nextStatus: AiExecutionStatus
  patch?: AiInvocationPatch
}

export interface AiGateSnapshot {
  overallEnabled: boolean
  featureEnabled: boolean
  entitled: boolean
  qualityProfile: AiQualityProfile
  userQuota: {
    allowed: boolean
    remaining: number
  }
}

export interface AiGovernancePort {
  resolve(input: {
    scope: AiScope
    actorUserId: string
    feature: AiFeatureDefinition
    requestedQualityProfile?: AiQualityProfile
  }): Promise<AiGateSnapshot>
}

export interface AuthorizedAiContext {
  source: AiBusinessObjectRef
  fields: Readonly<Record<string, AiJsonValue>>
}

export interface AuthorizedContextLoader {
  load(input: {
    authContext: AuthContext
    scope: AiScope
    feature: AiFeatureDefinition
    businessObject: AiBusinessObjectRef
  }): Promise<AuthorizedAiContext>
}

export interface AiProviderRequest {
  invocationId: string
  featureCode: string
  qualityProfile: AiQualityProfile
  writingStyle: AiWritingStyle | null
  configVersion: string
  promptTemplateVersion: string
  technicalLimits: AiTechnicalLimits
  authorizedContext: AuthorizedAiContext
  providerMapping: AiProviderMapping
  signal?: AbortSignal
}

export interface AiProviderUsage {
  inputUnits: number | null
  outputUnits: number | null
}

export interface AiProviderMetadata {
  providerCode: string
  modelFamily: string
  modelId?: string | null
  reasoningProfile: string
  requestId: string | null
  usage: AiProviderUsage | null
}

export interface AiProviderResponse {
  output: unknown
  metadata: AiProviderMetadata
}

export interface ProviderPort {
  execute(request: AiProviderRequest): Promise<AiProviderResponse>
}

export type AiProviderSafetyBlockReason =
  | 'AI_PROVIDER_DISABLED'
  | 'AI_PROVIDER_HOURLY_LIMIT'
  | 'AI_PROVIDER_DAILY_LIMIT'
  | 'AI_PROVIDER_CONCURRENCY_LIMIT'
  | 'AI_PROVIDER_INVOCATION_LIMIT'
  | 'AI_PROVIDER_INPUT_TOO_LARGE'
  | 'AI_PROVIDER_OUTPUT_TOO_LARGE'

export interface AiProviderSafetyReservationInput {
  invocationId: string
  scope: AiScope
  actorUserId: string
  inputSizeCharacters: number
  featureMaxInputCharacters: number
  requestedOutputTokens: number
}

export interface AiProviderSafetyLease {
  leaseId: string
  invocationId: string
  environment: string
  countedAt: string
  expiresAt: string
}

export interface ProviderSafetyPort {
  reserve(input: AiProviderSafetyReservationInput): Promise<AiProviderSafetyLease>
  complete(lease: AiProviderSafetyLease): Promise<void>
}

export interface AiResultValidator<T> {
  validate(output: unknown): T
}

export interface AiCreditReservationRequest {
  scope: AiScope
  invocationId: string
  actorUserId: string
  featureCode: string
  chargeReference: string
  month: string
  idempotencyKey: string
}

export interface AiCreditReservation {
  reservationId: string
  invocationId: string
  chargeReference: string
  units: number
}

export interface AiCreditSettlementRequest {
  reservation: AiCreditReservation
  outcome: 'SUCCEEDED'
}

export interface AiCreditReleaseRequest {
  reservation: AiCreditReservation
  reason: 'CONTEXT_FAILED' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_FAILED' | 'INVALID_RESULT' | 'INTERNAL_FAILURE'
}

export interface CreditsPort {
  ensureMonthlyAllowance(scope: AiScope, month: string): Promise<void>
  reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation>
  settle(input: AiCreditSettlementRequest): Promise<void>
  release(input: AiCreditReleaseRequest): Promise<void>
}

export interface InvocationRepository {
  createOrGet(input: NewAiInvocation): Promise<{ invocation: AiInvocation; created: boolean }>
  transition(input: AiStateTransition): Promise<AiInvocation>
}

export type TechnicalUsageOutcome = 'SUCCEEDED' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_FAILED' | 'INVALID_RESULT'

export interface TechnicalUsageEvent {
  invocationId: string
  scope: AiScope
  actorUserId: string
  featureCode: string
  qualityProfile: AiQualityProfile
  outcome: TechnicalUsageOutcome
  providerMetadata: AiProviderMetadata | null
  latencyMs: number
  correlationId: string
  configVersion: string
  promptTemplateVersion: string
  recordedAt: string
}

export interface TechnicalUsageSink {
  record(event: TechnicalUsageEvent): Promise<void>
}

export interface BusinessAuditEvent {
  invocationId: string
  scope: AiScope
  actorUserId: string
  actorEmployeeId: string | null
  featureCode: string
  businessObject: AiBusinessObjectRef
  action: 'AI_INVOCATION'
  qualityProfile: AiQualityProfile | null
  writingStyle: AiWritingStyle | null
  reservedCredits: number
  chargedCredits: number
  status: AiAuditStatus
  failureCode: AiFailureCode | null
  correlationId: string
  configVersion: string
  promptTemplateVersion: string
  recordedAt: string
}

export interface BusinessAuditSink {
  record(event: BusinessAuditEvent): Promise<void>
}

export interface HrGroupTimeZoneResolver {
  resolve(scope: AiScope): Promise<string>
}

export interface AiClock {
  now(): Date
}

export interface AiRuntimeDependencies<T> {
  registry: AiFeatureRegistry
  governance: AiGovernancePort
  credits: CreditsPort
  contextLoader: AuthorizedContextLoader
  provider: ProviderPort
  providerSafety: ProviderSafetyPort
  validator: AiResultValidator<T>
  repository: InvocationRepository
  technicalUsage: TechnicalUsageSink
  businessAudit: BusinessAuditSink
  timeZoneResolver: HrGroupTimeZoneResolver
  clock: AiClock
  createId: () => string
}

export class AiExecutionError extends Error {
  readonly name: string = 'AiExecutionError'
  readonly status: number

  constructor(readonly code: AiFailureCode, status = statusForAiFailure(code)) {
    super(code)
    this.status = status
  }
}

export class AiProviderError extends AiExecutionError {
  readonly name = 'AiProviderError'

  constructor(
    code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_FAILED',
    readonly providerMetadata: AiProviderMetadata | null = null,
    readonly classification: AiProviderFailureClassification = 'UNKNOWN',
  ) {
    super(code)
  }
}

export type AiProviderFailureClassification =
  | 'TIMEOUT'
  | 'ABORTED'
  | 'AUTHENTICATION'
  | 'CONFIGURATION'
  | 'RATE_LIMIT'
  | 'UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN'

export type AiExecutionResult<T> =
  | { kind: 'SUCCEEDED'; invocation: AiInvocation; output: T; replayed: false }
  | { kind: 'DUPLICATE'; invocation: AiInvocation; replayed: true }

export function statusForAiFailure(code: AiFailureCode): number {
  if (code === 'UNAUTHORIZED') return 403
  if (code === 'DUPLICATE_IN_FLIGHT' || code === 'DUPLICATE_COMPLETED' || code === 'IDEMPOTENCY_KEY_REUSED') return 409
  if (code === 'CREDITS_EXHAUSTED') return 402
  if (code === 'FEATURE_NOT_ENTITLED' || code === 'AI_DISABLED' || code === 'QUOTA_REACHED') return 403
  return 422
}
