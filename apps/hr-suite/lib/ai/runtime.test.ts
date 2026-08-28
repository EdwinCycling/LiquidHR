import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { AiExecutionError, type AiFeatureDefinition, type AiGateSnapshot, type AiResultValidator, type AiRuntimeDependencies, type AiScope } from './contracts'
import type { AuthContext } from '@/lib/auth/permissions'
import { buildAiRequestFingerprint, InMemoryInvocationRepository } from './invocation-repository'
import { runAiInvocation } from './orchestrator'
import { DeterministicTestProvider } from './test-provider'
import { InMemoryProviderSafety, TEST_PROVIDER_SAFETY_DEFAULTS } from './provider-safety'
import { RecordingBusinessAuditSink, RecordingTechnicalUsageSink, TestContextLoader, TestCreditsPort, TestFeatureRegistry, TestGovernancePort, fixedClock } from './test-doubles'

interface TestProposal {
  resultType: 'PROPOSAL'
  proposedText: string
  requiresHumanReview: true
}

const testFeature: AiFeatureDefinition = {
  featureCode: 'test-ai-runtime',
  capabilityGroup: 'TEST',
  productStatus: 'INTERNAL_TEST',
  minimumEdition: 'FOUNDATION',
  permittedQualityProfiles: ['EFFICIENT', 'BALANCED', 'IN_DEPTH'],
  defaultQualityProfile: 'BALANCED',
  chargeStrategy: 'FIXED_PER_FEATURE_AND_PROFILE',
  chargeReferenceByProfile: {
    EFFICIENT: 'test.efficient',
    BALANCED: 'test.balanced',
    IN_DEPTH: 'test.in-depth',
  },
  providerMappingByProfile: {
    EFFICIENT: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'TEST_EFFICIENT' },
    BALANCED: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'TEST_BALANCED' },
    IN_DEPTH: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'TEST_IN_DEPTH' },
  },
  technicalLimits: { maxInputCharacters: 1000, maxContextItems: 5, maxOutputCharacters: 1000, timeoutMs: 1000 },
  supportsWritingStyle: true,
  allowedResultType: 'PROPOSAL',
  promptTemplateVersion: 'test.prompt.v1',
  configVersion: 'test.config.v1',
}

const gates: AiGateSnapshot = {
  overallEnabled: true,
  featureEnabled: true,
  entitled: true,
  qualityProfile: 'BALANCED',
  userQuota: { allowed: true, remaining: 10 },
}

const authContext: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_ADMIN'],
  permissions: ['ai:use', 'employee:read'],
}

const businessObject = { type: 'employee-note', id: 'note-1' } as const

function validator(): AiResultValidator<TestProposal> {
  return {
    validate(output: unknown): TestProposal {
      if (typeof output !== 'object' || output === null || Array.isArray(output)) throw new Error('invalid')
      const candidate = output as Record<string, unknown>
      if (candidate.resultType !== 'PROPOSAL' || typeof candidate.proposedText !== 'string' || candidate.requiresHumanReview !== true) throw new Error('invalid')
      return {
        resultType: 'PROPOSAL',
        proposedText: candidate.proposedText,
        requiresHumanReview: true,
      }
    },
  }
}

function scopeFromContext(context: typeof authContext): AiScope {
  return {
    tenantId: context.tenantId,
    hrGroupId: context.hrGroupId ?? '',
    administrationId: context.administrationId,
  }
}

function dependencies(options: {
  gates?: AiGateSnapshot
  provider?: DeterministicTestProvider
  providerSafety?: InMemoryProviderSafety
  credits?: TestCreditsPort
  repository?: InMemoryInvocationRepository
  businessObject?: typeof businessObject
} = {}): AiRuntimeDependencies<TestProposal> & {
  provider: DeterministicTestProvider
  credits: TestCreditsPort
  repository: InMemoryInvocationRepository
  technicalUsage: RecordingTechnicalUsageSink
  businessAudit: RecordingBusinessAuditSink
  providerSafety: InMemoryProviderSafety
} {
  const object = options.businessObject ?? businessObject
  const provider = options.provider ?? new DeterministicTestProvider()
  const providerSafety = options.providerSafety ?? new InMemoryProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, fixedClock())
  const credits = options.credits ?? new TestCreditsPort(2)
  const repository = options.repository ?? new InMemoryInvocationRepository()
  const technicalUsage = new RecordingTechnicalUsageSink()
  const businessAudit = new RecordingBusinessAuditSink()
  let nextId = 0

  return {
    registry: new TestFeatureRegistry(testFeature),
    governance: new TestGovernancePort(options.gates ?? gates),
    credits,
    contextLoader: new TestContextLoader({ source: object, fields: { sourceText: 'confidential test source' } }),
    provider,
    providerSafety,
    validator: validator(),
    repository,
    technicalUsage,
    businessAudit,
    timeZoneResolver: { resolve: async () => 'Europe/Amsterdam' },
    clock: fixedClock(),
    createId: () => `test-id-${nextId++}`,
  }
}

function input(overrides: Partial<Parameters<typeof runAiInvocation>[0]> = {}) {
  return {
    authContext,
    featureCode: testFeature.featureCode,
    businessObject,
    idempotencyKey: 'test-key-1',
    businessPermissionCode: 'employee:read',
    ...overrides,
  }
}

describe('AI runtime foundation', () => {
  it('valideert output, settle eenmalig en schrijft gescheiden usage/audit', async () => {
    const runtime = dependencies()

    const result = await runAiInvocation(input(), runtime)

    expect(result.kind).toBe('SUCCEEDED')
    if (result.kind !== 'SUCCEEDED') throw new Error('Expected success')
    expect(result.output).toEqual({ resultType: 'PROPOSAL', proposedText: 'Test proposal for test-ai-runtime', requiresHumanReview: true })
    expect(result.invocation.executionStatus).toBe('SUCCEEDED')
    expect(result.invocation.resultStatus).toBe('VALIDATED')
    expect(result.invocation.reservedCredits).toBe(2)
    expect(result.invocation.chargedCredits).toBe(2)
    expect(runtime.provider.calls).toHaveLength(1)
    expect(runtime.credits.settleCalls).toHaveLength(1)
    expect(runtime.credits.releaseCalls).toHaveLength(0)
    expect(runtime.technicalUsage.events).toHaveLength(1)
    expect(runtime.businessAudit.events).toHaveLength(1)
    expect(runtime.businessAudit.events[0]).toMatchObject({ status: 'SUCCEEDED', chargedCredits: 2, scope: scopeFromContext(authContext) })
  })

  it('blokkeert zonder AI- of business-permission vóór provider-call', async () => {
    const provider = new DeterministicTestProvider()
    const runtime = dependencies({ provider })

    await expect(runAiInvocation(input({ authContext: { ...authContext, permissions: ['employee:read'] } }), runtime))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(runAiInvocation(input({ authContext: { ...authContext, permissions: ['ai:use'] }, businessPermissionCode: 'employee:read' }), runtime))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(provider.calls).toHaveLength(0)
  })

  it.each([
    ['overall disabled', { overallEnabled: false }],
    ['feature disabled', { featureEnabled: false }],
    ['not entitled', { entitled: false }],
    ['quota reached', { userQuota: { allowed: false, remaining: 0 } }],
  ] as const)('faalt gesloten wanneer een governance-gate faalt: %s', async (_label, override) => {
    const provider = new DeterministicTestProvider()
    const runtime = dependencies({ provider, gates: { ...gates, ...override } })
    await expect(runAiInvocation(input(), runtime)).rejects.toMatchObject({
      code: _label === 'overall disabled' ? 'AI_DISABLED' : _label === 'feature disabled' ? 'FEATURE_UNAVAILABLE' : _label === 'not entitled' ? 'FEATURE_NOT_ENTITLED' : 'QUOTA_REACHED',
    })
    expect(provider.calls).toHaveLength(0)
    expect(runtime.credits.reserveCalls).toHaveLength(0)
  })

  it('faalt gesloten bij uitgeputte credits', async () => {
    const provider = new DeterministicTestProvider()
    const credits = new TestCreditsPort()
    credits.reserveFailure = new AiExecutionError('CREDITS_EXHAUSTED')
    const runtime = dependencies({ provider, credits })

    await expect(runAiInvocation(input(), runtime)).rejects.toMatchObject({ code: 'CREDITS_EXHAUSTED' })
    expect(provider.calls).toHaveLength(0)
    expect(credits.reserveCalls).toHaveLength(1)
    expect(credits.settleCalls).toHaveLength(0)
    expect(credits.releaseCalls).toHaveLength(0)
    expect(runtime.providerSafety.reserveCalls).toHaveLength(0)
  })

  it('faalt gesloten op provider kill switch vóór de provider-call', async () => {
    const provider = new DeterministicTestProvider()
    const providerSafety = new InMemoryProviderSafety({ environment: 'test', enabled: false, ...TEST_PROVIDER_SAFETY_DEFAULTS }, fixedClock())
    const runtime = dependencies({ provider, providerSafety })

    await expect(runAiInvocation(input({ idempotencyKey: 'provider-disabled' }), runtime))
      .rejects.toMatchObject({ code: 'AI_PROVIDER_DISABLED' })
    expect(provider.calls).toHaveLength(0)
    expect(runtime.providerSafety.reserveCalls).toHaveLength(1)
    expect(runtime.credits.releaseCalls).toHaveLength(1)
  })

  it('voert gelijktijdige duplicate keys maximaal eenmaal uit en charge’t eenmaal', async () => {
    let unblock: (() => void) | undefined
    const blocker = new Promise<void>((resolve) => { unblock = resolve })
    const provider = new DeterministicTestProvider()
    const runtime = dependencies({ provider })
    runtime.governance = { resolve: async () => { await blocker; return gates } }

    const first = runAiInvocation(input(), runtime)
    await Promise.resolve()
    const second = runAiInvocation(input(), runtime)
    unblock?.()
    const results = await Promise.allSettled([first, second])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(rejected?.reason).toMatchObject({ code: 'DUPLICATE_IN_FLIGHT' })
    expect(provider.calls).toHaveLength(1)
    expect(runtime.credits.reserveCalls).toHaveLength(1)
    expect(runtime.credits.settleCalls).toHaveLength(1)
  })

  it('geeft terminale duplicates read-only terug en maakt Try Again een nieuwe invocation', async () => {
    const provider = new DeterministicTestProvider()
    const runtime = dependencies({ provider })

    const first = await runAiInvocation(input(), runtime)
    const duplicate = await runAiInvocation(input(), runtime)
    const retry = await runAiInvocation(input({ idempotencyKey: 'test-key-2' }), runtime)

    expect(first.kind).toBe('SUCCEEDED')
    expect(duplicate).toMatchObject({ kind: 'DUPLICATE', replayed: true })
    expect(retry.kind).toBe('SUCCEEDED')
    expect(provider.calls).toHaveLength(2)
    expect(runtime.credits.settleCalls).toHaveLength(2)
  })

  it('isoleert tenant en HR-groep in idempotency en audit', async () => {
    const provider = new DeterministicTestProvider()
    const runtime = dependencies({ provider })
    const otherTenant = { ...authContext, tenantId: 'tenant-2', hrGroupId: 'group-2' }

    await runAiInvocation(input(), runtime)
    await runAiInvocation(input({ authContext: otherTenant }), runtime)

    expect(provider.calls).toHaveLength(2)
    expect(runtime.businessAudit.events.map((event) => event.scope.tenantId)).toEqual(['tenant-1', 'tenant-2'])
    expect(runtime.businessAudit.events.map((event) => event.scope.hrGroupId)).toEqual(['group-1', 'group-2'])
  })

  it('release’t na provider failure en settle’t niets', async () => {
    const runtime = dependencies({ provider: new DeterministicTestProvider('FAILED') })

    await expect(runAiInvocation(input(), runtime)).rejects.toMatchObject({ code: 'PROVIDER_FAILED' })
    expect(runtime.credits.releaseCalls).toHaveLength(1)
    expect(runtime.credits.releaseCalls[0].reason).toBe('PROVIDER_FAILED')
    expect(runtime.credits.settleCalls).toHaveLength(0)
    expect(runtime.technicalUsage.events[0]).toMatchObject({ outcome: 'PROVIDER_FAILED' })
    expect(runtime.businessAudit.events[0]).toMatchObject({ status: 'FAILED', failureCode: 'PROVIDER_FAILED', chargedCredits: 0 })
    expect(runtime.providerSafety.completeCalls).toHaveLength(1)
  })

  it('release’t bij invalid resultaat en markeert technische usage apart', async () => {
    const runtime = dependencies({ provider: new DeterministicTestProvider('INVALID_RESULT') })

    await expect(runAiInvocation(input(), runtime)).rejects.toMatchObject({ code: 'INVALID_RESULT' })
    expect(runtime.credits.releaseCalls).toHaveLength(1)
    expect(runtime.credits.releaseCalls[0].reason).toBe('INVALID_RESULT')
    expect(runtime.credits.settleCalls).toHaveLength(0)
    expect(runtime.technicalUsage.events[0]).toMatchObject({ outcome: 'INVALID_RESULT' })
    expect(runtime.businessAudit.events[0]).toMatchObject({ status: 'FAILED', failureCode: 'INVALID_RESULT' })
  })

  it('draagt context, charge reference en versies door zonder raw content naar sinks', async () => {
    const runtime = dependencies({ gates: { ...gates, qualityProfile: 'IN_DEPTH' } })

    await runAiInvocation(input({ qualityProfile: 'IN_DEPTH', writingStyle: 'PLAIN' }), runtime)

    expect(runtime.provider.calls[0]).toMatchObject({
      qualityProfile: 'IN_DEPTH',
      writingStyle: 'PLAIN',
      configVersion: 'test.config.v1',
      promptTemplateVersion: 'test.prompt.v1',
      authorizedContext: { fields: { sourceText: 'confidential test source' } },
    })
    expect(runtime.credits.reserveCalls[0]).toMatchObject({ chargeReference: 'test.in-depth', month: '2026-08' })
    expect(runtime.technicalUsage.events[0]).not.toHaveProperty('authorizedContext')
    expect(runtime.businessAudit.events[0]).not.toHaveProperty('prompt')
    expect(runtime.businessAudit.events[0]).not.toHaveProperty('response')
    expect(runtime.businessAudit.events[0]).not.toHaveProperty('sourceText')
  })

  it('weigert idempotency-keyhergebruik met een andere request fingerprint', async () => {
    const runtime = dependencies()
    await runAiInvocation(input(), runtime)

    await expect(runAiInvocation(input({ businessObject: { type: 'employee-note', id: 'note-2' } }), runtime))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
    expect(runtime.provider.calls).toHaveLength(1)
  })

  it('berekent dezelfde fingerprint voor dezelfde canonical input', () => {
    const first = buildAiRequestFingerprint(input())
    const second = buildAiRequestFingerprint(input())
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })
})
