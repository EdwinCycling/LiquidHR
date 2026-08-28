import 'server-only'

import { createHash } from 'node:crypto'
import { AiExecutionError, type AiInvocation, type AiInvocationInput, type AiStateTransition, type InvocationRepository, type NewAiInvocation } from './contracts'
import { canTransition } from './state-machine'

export function buildAiRequestFingerprint(input: Pick<AiInvocationInput, 'authContext' | 'featureCode' | 'businessObject' | 'businessPermissionCode' | 'idempotencyKey' | 'qualityProfile' | 'writingStyle'>): string {
  const canonicalInput = {
    tenantId: input.authContext.tenantId,
    hrGroupId: input.authContext.hrGroupId ?? null,
    administrationId: input.authContext.administrationId,
    actorUserId: input.authContext.userId,
    featureCode: input.featureCode,
    businessObject: input.businessObject,
    businessPermissionCode: input.businessPermissionCode,
    idempotencyKey: input.idempotencyKey,
    qualityProfile: input.qualityProfile ?? null,
    writingStyle: input.writingStyle ?? null,
  }

  return createHash('sha256').update(JSON.stringify(canonicalInput)).digest('hex')
}

function invocationKey(input: Pick<NewAiInvocation, 'scope' | 'actorUserId' | 'idempotencyKey'>): string {
  return JSON.stringify([input.scope.tenantId, input.scope.hrGroupId, input.actorUserId, input.idempotencyKey])
}

function copyInvocation(invocation: AiInvocation): AiInvocation {
  return {
    ...invocation,
    scope: { ...invocation.scope },
    businessObject: { ...invocation.businessObject },
    providerMetadata: invocation.providerMetadata
      ? {
          ...invocation.providerMetadata,
          usage: invocation.providerMetadata.usage ? { ...invocation.providerMetadata.usage } : null,
        }
      : null,
  }
}

export class InMemoryInvocationRepository implements InvocationRepository {
  private readonly byKey = new Map<string, AiInvocation>()
  private readonly byId = new Map<string, AiInvocation>()

  async createOrGet(input: NewAiInvocation): Promise<{ invocation: AiInvocation; created: boolean }> {
    const key = invocationKey(input)
    const existing = this.byKey.get(key)

    if (existing) {
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new AiExecutionError('IDEMPOTENCY_KEY_REUSED')
      }
      return { invocation: copyInvocation(existing), created: false }
    }

    const invocation: AiInvocation = {
      ...input,
      scope: { ...input.scope },
      businessObject: { ...input.businessObject },
      qualityProfile: null,
      writingStyle: input.writingStyle,
      executionStatus: 'RECEIVED',
      resultStatus: 'PENDING',
      feedbackOutcome: null,
      reservedCredits: 0,
      chargedCredits: 0,
      providerMetadata: null,
      latencyMs: null,
      failureCode: null,
      updatedAt: input.createdAt,
      startedAt: null,
      finishedAt: null,
    }

    this.byKey.set(key, invocation)
    this.byId.set(invocation.id, invocation)
    return { invocation: copyInvocation(invocation), created: true }
  }

  async transition(input: AiStateTransition): Promise<AiInvocation> {
    const current = this.byId.get(input.invocationId)
    if (!current || current.executionStatus !== input.expectedStatus || !canTransition(input.expectedStatus, input.nextStatus)) {
      throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    }

    const updated: AiInvocation = {
      ...current,
      ...input.patch,
      executionStatus: input.nextStatus,
      updatedAt: input.patch?.updatedAt ?? new Date().toISOString(),
      scope: { ...current.scope },
      businessObject: { ...current.businessObject },
      providerMetadata: input.patch?.providerMetadata
        ? {
            ...input.patch.providerMetadata,
            usage: input.patch.providerMetadata.usage ? { ...input.patch.providerMetadata.usage } : null,
          }
        : current.providerMetadata,
    }

    this.byId.set(updated.id, updated)
    this.byKey.set(invocationKey(updated), updated)
    return copyInvocation(updated)
  }
}
