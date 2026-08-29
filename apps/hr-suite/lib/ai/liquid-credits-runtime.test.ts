import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type {
  AiFeatureDefinition,
  AiGateSnapshot,
  AiResultValidator,
  AiRuntimeDependencies,
  AiScope,
} from './contracts'
import type { AuthContext } from '@/lib/auth/permissions'
import { InMemoryInvocationRepository } from './invocation-repository'
import { runAiInvocation } from './orchestrator'
import { InMemoryLiquidCreditsService } from './liquid-credits-test-double'
import { DeterministicTestProvider } from './test-provider'
import { InMemoryProviderSafety, TEST_PROVIDER_SAFETY_DEFAULTS } from './provider-safety'
import {
  RecordingBusinessAuditSink,
  RecordingTechnicalUsageSink,
  TestContextLoader,
  TestFeatureRegistry,
  TestGovernancePort,
  fixedClock,
} from './test-doubles'

interface TestProposal {
  resultType: 'PROPOSAL'
  proposedText: string
  requiresHumanReview: true
}

const feature: AiFeatureDefinition = {
  featureCode: 'improve-existing-hr-text',
  capabilityGroup: 'HR_TEXT',
  productStatus: 'INTERNAL_TEST',
  minimumEdition: 'FOUNDATION',
  permittedQualityProfiles: ['EFFICIENT', 'BALANCED', 'IN_DEPTH'],
  defaultQualityProfile: 'BALANCED',
  chargeStrategy: 'FIXED_PER_FEATURE_AND_PROFILE',
  chargeReferenceByProfile: {
    EFFICIENT: 'ai.improve-existing-hr-text.efficient',
    BALANCED: 'ai.improve-existing-hr-text.balanced',
    IN_DEPTH: 'ai.improve-existing-hr-text.in-depth',
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
  userId: 'actor-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_ADMIN'],
  permissions: ['ai:use', 'employee:read'],
}

const scope: AiScope = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
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

function runtime(provider = new DeterministicTestProvider()): {
  dependencies: AiRuntimeDependencies<TestProposal>
  credits: InMemoryLiquidCreditsService
  provider: DeterministicTestProvider
} {
  const credits = new InMemoryLiquidCreditsService({
    now: fixedClock().now,
    groupPolicies: { 'tenant-1:group-1': { monthlyAllowanceCredits: 100, timeZone: 'Europe/Amsterdam' } },
    actorRoles: { 'tenant-1:group-1:actor-1': ['HR_ADMIN'] },
  })
  const repository = new InMemoryInvocationRepository()
  const technicalUsage = new RecordingTechnicalUsageSink()
  const businessAudit = new RecordingBusinessAuditSink()
  const providerSafety = new InMemoryProviderSafety({ environment: 'test', enabled: true, ...TEST_PROVIDER_SAFETY_DEFAULTS }, fixedClock())
  let id = 0
  return {
    dependencies: {
      registry: new TestFeatureRegistry(feature),
      governance: new TestGovernancePort(gates),
      credits,
      contextLoader: new TestContextLoader({ source: businessObject, fields: { sourceText: 'confidential test source' } }),
      provider,
      providerSafety,
      validator: validator(),
      repository,
      technicalUsage,
      businessAudit,
      timeZoneResolver: { resolve: async () => 'Europe/Amsterdam' },
      clock: fixedClock(),
      createId: () => `runtime-id-${id++}`,
    },
    credits,
    provider,
  }
}

function input(idempotencyKey: string) {
  return {
    authContext,
    featureCode: feature.featureCode,
    businessObject,
    idempotencyKey,
    businessPermissionCode: 'employee:read',
  }
}

describe('Wave 1B Liquid Credits via Wave 1A orchestrator', () => {
  it('settlet een geslaagde provider-executie tegen de echte credits service', async () => {
    const testRuntime = runtime()

    const result = await runAiInvocation(input('success-key'), testRuntime.dependencies)

    expect(result.kind).toBe('SUCCEEDED')
    await expect(testRuntime.credits.readGroupUsageBalance(scope)).resolves.toMatchObject({
      reservedCredits: 0,
      settledCredits: 2,
      availableCredits: 98,
    })
    await expect(testRuntime.credits.readActorQuotaUsage({ scope, actorUserId: 'actor-1', month: '2026-08' })).resolves.toMatchObject({
      usedCredits: 2,
      remainingCredits: 98,
    })
  })

  it('release’t de reservation bij provider failure en charge’t geen success', async () => {
    const testRuntime = runtime(new DeterministicTestProvider('FAILED'))

    await expect(runAiInvocation(input('failure-key'), testRuntime.dependencies)).rejects.toMatchObject({ code: 'PROVIDER_FAILED' })
    await expect(testRuntime.credits.readGroupUsageBalance(scope)).resolves.toMatchObject({
      reservedCredits: 0,
      settledCredits: 0,
      availableCredits: 100,
    })
    await expect(testRuntime.credits.readActorQuotaUsage({ scope, actorUserId: 'actor-1', month: '2026-08' })).resolves.toMatchObject({
      usedCredits: 0,
      releasedCredits: 2,
      remainingCredits: 100,
    })
  })

  it('maakt duplicate retries read-only en rekent Try Again als nieuwe invocation', async () => {
    const testRuntime = runtime()

    await runAiInvocation(input('first-key'), testRuntime.dependencies)
    const duplicate = await runAiInvocation(input('first-key'), testRuntime.dependencies)
    await runAiInvocation(input('try-again-key'), testRuntime.dependencies)

    expect(duplicate).toMatchObject({ kind: 'DUPLICATE', replayed: true })
    expect(testRuntime.provider.calls).toHaveLength(2)
    await expect(testRuntime.credits.readGroupUsageBalance(scope)).resolves.toMatchObject({
      settledCredits: 4,
      availableCredits: 96,
    })
  })
})
