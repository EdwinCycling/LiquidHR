import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { AiExecutionError, type AiProviderSafetyBlockReason, type AiProviderSafetyLease, type AiProviderSafetyReservationInput, type ProviderSafetyPort } from './contracts'

export type ProviderSafetyMode = 'TEST' | 'OPENAI'
export type ProviderSafetyEnvironment = 'test' | 'development' | 'production'

export interface ProviderSafetyEnvironmentSource {
  readonly NODE_ENV?: string
  readonly AI_PROVIDER_ENABLED?: string
  readonly AI_PROVIDER_MAX_CALLS_PER_HOUR?: string
  readonly AI_PROVIDER_MAX_CALLS_PER_DAY?: string
  readonly AI_PROVIDER_MAX_CONCURRENT?: string
  readonly AI_PROVIDER_GLOBAL_MAX_OUTPUT_TOKENS?: string
  readonly AI_PROVIDER_GLOBAL_MAX_INPUT_CHARACTERS?: string
  readonly AI_PROVIDER_LEASE_SECONDS?: string
  readonly [key: string]: string | undefined
}

export interface ProviderSafetyConfig {
  readonly environment: ProviderSafetyEnvironment
  readonly enabled: boolean
  readonly maxCallsPerHour: number
  readonly maxCallsPerDay: number
  readonly maxConcurrent: number
  readonly globalMaxOutputTokens: number
  readonly globalMaxInputCharacters: number
  readonly leaseSeconds: number
}

export interface ProviderSafetyClock {
  now(): Date
}

export const TEST_PROVIDER_SAFETY_DEFAULTS = Object.freeze({
  maxCallsPerHour: 5,
  maxCallsPerDay: 20,
  maxConcurrent: 2,
  globalMaxOutputTokens: 4096,
  globalMaxInputCharacters: 16_000,
  leaseSeconds: 120,
})

export class ProviderSafetyConfigurationError extends AiExecutionError {
  readonly name = 'ProviderSafetyConfigurationError'

  constructor() {
    super('AI_PROVIDER_SAFETY_UNAVAILABLE')
  }
}

export class ProviderSafetyError extends AiExecutionError {
  readonly name = 'ProviderSafetyError'

  constructor(readonly reason: AiProviderSafetyBlockReason) {
    super(reason)
  }
}

function environmentFor(source: ProviderSafetyEnvironmentSource): ProviderSafetyEnvironment {
  if (source.NODE_ENV === 'test') return 'test'
  if (source.NODE_ENV === 'development') return 'development'
  return 'production'
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  throw new ProviderSafetyConfigurationError()
}

function parseLimit(value: string | undefined, fallback: number, required: boolean): number {
  if (value === undefined || value.trim().length === 0) {
    if (required) throw new ProviderSafetyConfigurationError()
    return fallback
  }
  if (!/^\d+$/.test(value.trim())) throw new ProviderSafetyConfigurationError()
  const parsed = Number(value.trim())
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1_000_000) throw new ProviderSafetyConfigurationError()
  return parsed
}

function parsedLimits(source: ProviderSafetyEnvironmentSource, required: boolean): Omit<ProviderSafetyConfig, 'environment' | 'enabled'> {
  const values = [
    parseLimit(source.AI_PROVIDER_MAX_CALLS_PER_HOUR, TEST_PROVIDER_SAFETY_DEFAULTS.maxCallsPerHour, required),
    parseLimit(source.AI_PROVIDER_MAX_CALLS_PER_DAY, TEST_PROVIDER_SAFETY_DEFAULTS.maxCallsPerDay, required),
    parseLimit(source.AI_PROVIDER_MAX_CONCURRENT, TEST_PROVIDER_SAFETY_DEFAULTS.maxConcurrent, required),
    parseLimit(source.AI_PROVIDER_GLOBAL_MAX_OUTPUT_TOKENS, TEST_PROVIDER_SAFETY_DEFAULTS.globalMaxOutputTokens, required),
    parseLimit(source.AI_PROVIDER_GLOBAL_MAX_INPUT_CHARACTERS, TEST_PROVIDER_SAFETY_DEFAULTS.globalMaxInputCharacters, required),
    parseLimit(source.AI_PROVIDER_LEASE_SECONDS, TEST_PROVIDER_SAFETY_DEFAULTS.leaseSeconds, required),
  ]
  const [maxCallsPerHour, maxCallsPerDay, maxConcurrent, globalMaxOutputTokens, globalMaxInputCharacters, leaseSeconds] = values
  if (maxCallsPerHour > maxCallsPerDay) throw new ProviderSafetyConfigurationError()
  return { maxCallsPerHour, maxCallsPerDay, maxConcurrent, globalMaxOutputTokens, globalMaxInputCharacters, leaseSeconds }
}

export function resolveProviderSafetyConfig(
  source: ProviderSafetyEnvironmentSource = process.env,
  mode: ProviderSafetyMode = 'OPENAI',
): ProviderSafetyConfig {
  const environment = environmentFor(source)
  if (mode === 'TEST') return { environment, enabled: true, ...parsedLimits(source, false) }

  const enabled = parseBoolean(source.AI_PROVIDER_ENABLED)
  if (enabled === null) throw new ProviderSafetyConfigurationError()
  if (!enabled) return { environment, enabled: false, ...TEST_PROVIDER_SAFETY_DEFAULTS }
  return { environment, enabled: true, ...parsedLimits(source, true) }
}

interface InMemoryLease extends AiProviderSafetyLease {
  status: 'ACTIVE' | 'COMPLETED'
}

function validDate(value: Date): boolean {
  return !Number.isNaN(value.valueOf())
}

function floorUtcHour(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), value.getUTCHours())
}

function floorUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

function validateConfig(config: ProviderSafetyConfig): void {
  if (!config.environment || !['test', 'development', 'production'].includes(config.environment)) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.maxCallsPerHour) || config.maxCallsPerHour <= 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.maxCallsPerDay) || config.maxCallsPerDay <= 0 || config.maxCallsPerHour > config.maxCallsPerDay) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.maxConcurrent) || config.maxConcurrent <= 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.globalMaxOutputTokens) || config.globalMaxOutputTokens <= 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.globalMaxInputCharacters) || config.globalMaxInputCharacters <= 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(config.leaseSeconds) || config.leaseSeconds <= 0) throw new ProviderSafetyConfigurationError()
}

function validateReservationInput(input: AiProviderSafetyReservationInput): void {
  if (!input.invocationId.trim() || !input.actorUserId.trim() || !input.scope.tenantId.trim() || !input.scope.hrGroupId.trim()) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(input.inputSizeCharacters) || input.inputSizeCharacters < 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(input.featureMaxInputCharacters) || input.featureMaxInputCharacters <= 0) throw new ProviderSafetyConfigurationError()
  if (!Number.isSafeInteger(input.requestedOutputTokens) || input.requestedOutputTokens <= 0) throw new ProviderSafetyConfigurationError()
}

export class InMemoryProviderSafety implements ProviderSafetyPort {
  private readonly leases: InMemoryLease[] = []
  readonly reserveCalls: AiProviderSafetyReservationInput[] = []
  readonly completeCalls: AiProviderSafetyLease[] = []

  constructor(
    private readonly config: ProviderSafetyConfig,
    private readonly clock: ProviderSafetyClock,
  ) {
    validateConfig(config)
  }

  async reserve(input: AiProviderSafetyReservationInput): Promise<AiProviderSafetyLease> {
    this.reserveCalls.push(input)
    validateConfig(this.config)
    validateReservationInput(input)
    if (!this.config.enabled) throw new ProviderSafetyError('AI_PROVIDER_DISABLED')
    if (input.inputSizeCharacters > this.config.globalMaxInputCharacters || input.inputSizeCharacters > input.featureMaxInputCharacters) {
      throw new ProviderSafetyError('AI_PROVIDER_INPUT_TOO_LARGE')
    }
    if (input.requestedOutputTokens > this.config.globalMaxOutputTokens) throw new ProviderSafetyError('AI_PROVIDER_OUTPUT_TOO_LARGE')
    if (this.leases.some((lease) => lease.invocationId === input.invocationId)) throw new ProviderSafetyError('AI_PROVIDER_INVOCATION_LIMIT')

    const now = this.clock.now()
    if (!validDate(now)) throw new ProviderSafetyConfigurationError()
    const nowValue = now.valueOf()
    const hourlyCalls = this.leases.filter((lease) => Date.parse(lease.countedAt) >= floorUtcHour(now)).length
    if (hourlyCalls >= this.config.maxCallsPerHour) throw new ProviderSafetyError('AI_PROVIDER_HOURLY_LIMIT')
    const dailyCalls = this.leases.filter((lease) => Date.parse(lease.countedAt) >= floorUtcDay(now)).length
    if (dailyCalls >= this.config.maxCallsPerDay) throw new ProviderSafetyError('AI_PROVIDER_DAILY_LIMIT')
    const activeLeases = this.leases.filter((lease) => lease.status === 'ACTIVE' && Date.parse(lease.expiresAt) > nowValue)
    if (activeLeases.length >= this.config.maxConcurrent) throw new ProviderSafetyError('AI_PROVIDER_CONCURRENCY_LIMIT')

    const lease: InMemoryLease = {
      leaseId: `provider-safety-${this.leases.length + 1}`,
      invocationId: input.invocationId,
      environment: this.config.environment,
      countedAt: now.toISOString(),
      expiresAt: new Date(nowValue + this.config.leaseSeconds * 1000).toISOString(),
      status: 'ACTIVE',
    }
    this.leases.push(lease)
    return { ...lease }
  }

  async complete(lease: AiProviderSafetyLease): Promise<void> {
    this.completeCalls.push(lease)
    const existing = this.leases.find((candidate) => candidate.leaseId === lease.leaseId && candidate.invocationId === lease.invocationId)
    if (!existing) throw new ProviderSafetyConfigurationError()
    existing.status = 'COMPLETED'
  }
}

type SafetyRpcError = { readonly code?: string; readonly message?: string }

export interface ProviderSafetyRpcClient {
  rpc(
    name: 'reserve_ai_provider_execution',
    args: Record<string, string | number | boolean | null>,
  ): Promise<{ data: SafetyRpcRow[] | null; error: SafetyRpcError | null }>
  rpc(
    name: 'complete_ai_provider_execution',
    args: Record<string, string | number | boolean | null>,
  ): Promise<{ data: null; error: SafetyRpcError | null }>
}

interface SafetyRpcRow {
  allowed: boolean
  block_reason: string | null
  lease_id: string | null
  invocation_id: string | null
  environment: string | null
  counted_at: string | null
  expires_at: string | null
}

function isBlockReason(value: string | null): value is AiProviderSafetyBlockReason {
  return value === 'AI_PROVIDER_DISABLED'
    || value === 'AI_PROVIDER_HOURLY_LIMIT'
    || value === 'AI_PROVIDER_DAILY_LIMIT'
    || value === 'AI_PROVIDER_CONCURRENCY_LIMIT'
    || value === 'AI_PROVIDER_INVOCATION_LIMIT'
    || value === 'AI_PROVIDER_INPUT_TOO_LARGE'
    || value === 'AI_PROVIDER_OUTPUT_TOO_LARGE'
}

function safetyRpcClient(): ProviderSafetyRpcClient {
  return createAdminClient() as unknown as ProviderSafetyRpcClient
}

export class SupabaseProviderSafety implements ProviderSafetyPort {
  constructor(
    private readonly config: ProviderSafetyConfig,
    private readonly client?: ProviderSafetyRpcClient,
  ) {
    validateConfig(config)
  }

  async reserve(input: AiProviderSafetyReservationInput): Promise<AiProviderSafetyLease> {
    validateConfig(this.config)
    validateReservationInput(input)
    const result = await (this.client ?? safetyRpcClient()).rpc('reserve_ai_provider_execution', {
      requested_environment: this.config.environment,
      requested_invocation_id: input.invocationId,
      requested_tenant_id: input.scope.tenantId,
      requested_hr_group_id: input.scope.hrGroupId,
      requested_actor_user_id: input.actorUserId,
      requested_input_size_characters: input.inputSizeCharacters,
      requested_feature_max_input_characters: input.featureMaxInputCharacters,
      requested_output_tokens: input.requestedOutputTokens,
      requested_max_calls_per_hour: this.config.maxCallsPerHour,
      requested_max_calls_per_day: this.config.maxCallsPerDay,
      requested_max_concurrent: this.config.maxConcurrent,
      requested_global_max_output_tokens: this.config.globalMaxOutputTokens,
      requested_global_max_input_characters: this.config.globalMaxInputCharacters,
      requested_lease_seconds: this.config.leaseSeconds,
      requested_enabled: this.config.enabled,
    })
    if (result.error || !result.data || result.data.length !== 1) throw new ProviderSafetyConfigurationError()
    const row = result.data[0]
    if (!row.allowed) {
      if (!isBlockReason(row.block_reason)) throw new ProviderSafetyConfigurationError()
      throw new ProviderSafetyError(row.block_reason)
    }
    if (!row.lease_id || row.invocation_id !== input.invocationId || !row.environment || !row.counted_at || !row.expires_at) {
      throw new ProviderSafetyConfigurationError()
    }
    if (!validDate(new Date(row.counted_at)) || !validDate(new Date(row.expires_at))) throw new ProviderSafetyConfigurationError()
    return {
      leaseId: row.lease_id,
      invocationId: row.invocation_id,
      environment: row.environment,
      countedAt: row.counted_at,
      expiresAt: row.expires_at,
    }
  }

  async complete(lease: AiProviderSafetyLease): Promise<void> {
    if (!lease.leaseId.trim() || !lease.invocationId.trim()) throw new ProviderSafetyConfigurationError()
    const result = await (this.client ?? safetyRpcClient()).rpc('complete_ai_provider_execution', {
      requested_lease_id: lease.leaseId,
      requested_invocation_id: lease.invocationId,
    })
    if (result.error) throw new ProviderSafetyConfigurationError()
  }
}
