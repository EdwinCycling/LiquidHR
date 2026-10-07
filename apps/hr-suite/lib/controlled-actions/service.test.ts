import { describe, expect, it, vi } from 'vitest'
import type { Json } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  createControlledActionService,
  ControlledActionError,
  buildAuthorizedGoalPayload,
  type ControlledActionId,
  type ControlledActionDomain,
  type ControlledActionDraft,
  type ControlledActionStorage,
} from './service'

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  administrationId: null,
  userId: '10000000-0000-4000-8000-000000000002',
  employeeId: '10000000-0000-4000-8000-000000000003',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:write'],
}

const actionInput = {
  conversationId: '10000000-0000-4000-8000-000000000004',
  actionId: 'talent.development-goal.create' as const,
  payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
  idempotencyKey: '10000000-0000-4000-8000-000000000005',
  channel: 'HERA' as const,
  locale: 'nl' as const,
}

describe('authorized goal payload ordering', () => {
  it('keeps an implicit self target stable after the employee ID is persisted', () => {
    const targetEmployeeId = context.employeeId!
    const implicitTarget = buildAuthorizedGoalPayload({
      title: 'Synthetisch testdoel',
      periodStart: '2026-10-07',
      progressPercent: 0,
      status: 'DRAFT',
    }, targetEmployeeId)
    const explicitTarget = buildAuthorizedGoalPayload({
      employeeId: targetEmployeeId,
      title: 'Synthetisch testdoel',
      periodStart: '2026-10-07',
      progressPercent: 0,
      status: 'DRAFT',
    }, targetEmployeeId)

    expect(Object.keys(implicitTarget)[0]).toBe('employeeId')
    expect(implicitTarget).not.toHaveProperty('capabilityId')
    expect(implicitTarget).not.toHaveProperty('description')
    expect(implicitTarget).not.toHaveProperty('periodEnd')
    expect(JSON.stringify(implicitTarget)).toBe(JSON.stringify(explicitTarget))
  })
})

function setup(previewAllowed = true) {
  let draft: ControlledActionDraft | null = null
  let previewMarker = 'current'
  let currentTime = new Date('2026-10-06T09:00:00.000Z')
  const makePreview = (payload: unknown) => ({
    actionId: actionInput.actionId,
    actionType: 'TALENT_DEVELOPMENT_GOAL_CREATE' as const,
    toolName: 'draft_talent_development_goal',
    payload: payload as Json,
    summary: 'Ontwikkeldoel voorbereiden.',
    preview: {
      actionId: actionInput.actionId,
      summary: 'Ontwikkeldoel voorbereiden.',
      subject: 'self' as const,
      changes: { marker: previewMarker, payload: payload as Json },
    },
  })
  const domain: ControlledActionDomain = {
    preview: vi.fn(async (_actor, _action, payload) => {
      if (!previewAllowed) throw new Error('ACCESS_DENIED')
      return makePreview(payload)
    }),
    execute: vi.fn(async () => '10000000-0000-4000-8000-000000000006'),
    readback: vi.fn(async (_actor, _action, _payload, entityId) => ({ entityId, status: 'DRAFT' })),
  }
  const storage: ControlledActionStorage = {
    findByKey: vi.fn(async (_actor, key) => draft?.idempotencyKey === key ? draft : null),
    findById: vi.fn(async (_actor, id) => draft?.id === id ? draft : null),
    insert: vi.fn(async (_actor, input) => {
      draft = {
        id: '10000000-0000-4000-8000-000000000007',
        tenantId: context.tenantId,
        conversationId: input.conversationId,
        ownerUserId: context.userId,
        actionId: input.actionId,
        actionType: input.actionType,
        toolName: input.toolName,
        payload: input.payload,
        summary: input.summary,
        status: 'AWAITING_CONFIRMATION',
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
        confirmedAt: null,
        executedAt: null,
        failureCode: null,
        version: 1,
        controlPayload: input.controlPayload,
      }
      return draft
    }),
    confirm: vi.fn(async (_actor, current, expectedVersion, previewHash, correlationId) => {
      if (!draft || draft.version !== expectedVersion || draft.id !== current.id) return null
      const control = draft.controlPayload as Record<string, Json>
      draft = {
        ...draft,
        confirmedAt: '2026-10-06T09:00:00.000Z',
        version: expectedVersion + 1,
        controlPayload: { ...control, confirmedPreviewHash: previewHash, confirmedFromVersion: String(expectedVersion), correlationId },
      }
      return draft
    }),
    claim: vi.fn(async (_actor, current, expectedVersion, _previewHash, correlationId) => {
      if (!draft || draft.version !== expectedVersion || draft.id !== current.id || !draft.confirmedAt) return null
      draft = {
        ...draft,
        status: 'EXECUTING',
        version: expectedVersion + 1,
        controlPayload: { ...(draft.controlPayload as Record<string, Json>), correlationId },
      }
      return draft
    }),
    cancel: vi.fn(async (_actor, current, correlationId) => {
      if (!draft || draft.id !== current.id || draft.version !== current.version || draft.status !== 'AWAITING_CONFIRMATION') return null
      draft = {
        ...draft,
        status: 'CANCELLED',
        version: current.version + 1,
        controlPayload: { ...(draft.controlPayload as Record<string, Json>), correlationId },
      }
      return draft
    }),
    succeed: vi.fn(async (_actor, current, entityId, correlationId) => {
      if (!draft || draft.version !== current.version || draft.status !== 'EXECUTING') return null
      draft = {
        ...draft,
        status: 'SUCCEEDED',
        executedAt: '2026-10-06T09:00:01.000Z',
        version: current.version + 1,
        controlPayload: { ...(draft.controlPayload as Record<string, Json>), entityId, correlationId },
      }
      return draft
    }),
    fail: vi.fn(async (_actor, current, failureCode, correlationId) => {
      if (!draft || draft.version !== current.version || draft.status !== 'EXECUTING') return null
      draft = {
        ...draft,
        status: 'FAILED',
        failureCode,
        version: current.version + 1,
        controlPayload: { ...(draft.controlPayload as Record<string, Json>), correlationId },
      }
      return draft
    }),
  }
  const service = createControlledActionService({
    storage,
    domain,
    now: () => currentTime,
    newId: vi.fn().mockReturnValue('10000000-0000-4000-8000-000000000008'),
  })
  return {
    service,
    storage,
    domain,
    setPreviewMarker: (value: string) => { previewMarker = value },
    setNow: (value: string) => { currentTime = new Date(value) },
  }
}

describe('controlled action lifecycle', () => {
  it('runs prepare, preview, confirm, execute, and readback once with server-held preview binding', async () => {
    const { service, storage, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const correlationId = (prepared.draft.controlPayload as Record<string, Json>).correlationId
    expect(prepared.draft.status).toBe('AWAITING_CONFIRMATION')
    expect(prepared.preview?.actionId).toBe(actionInput.actionId)

    const preview = await service.preview(context, prepared.draft.id)
    const previewHash = (prepared.draft.controlPayload as Record<string, Json>).previewHash
    expect(preview.preview).toEqual(prepared.preview)
    expect(typeof previewHash).toBe('string')

    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: String(previewHash),
    })
    expect(confirmed.draft.confirmedAt).not.toBeNull()
    expect(confirmed.draft.status).toBe('AWAITING_CONFIRMATION')
    expect((confirmed.draft.controlPayload as Record<string, Json>).correlationId).toBe(correlationId)

    const executed = await service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: String(previewHash),
    })
    expect(executed.draft.status).toBe('SUCCEEDED')
    expect(executed.readback).toMatchObject({ status: 'DRAFT' })
    expect((executed.draft.controlPayload as Record<string, Json>).correlationId).toBe(correlationId)
    expect(domain.execute).toHaveBeenCalledTimes(1)

    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: String(previewHash),
    })).resolves.toMatchObject({ draft: { status: 'SUCCEEDED' } })
    expect(domain.execute).toHaveBeenCalledTimes(1)
    expect(storage.claim).toHaveBeenCalledTimes(1)
  })

  it('does not claim a domain transport failure is a definite failure or permit a retry', async () => {
    const { service, storage, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    vi.mocked(domain.execute).mockRejectedValueOnce(new Error('transport disconnected'))

    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN' })
    expect(storage.fail).not.toHaveBeenCalled()
    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version + 1,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_EXECUTION_OUTCOME_UNKNOWN' })
    expect(domain.execute).toHaveBeenCalledTimes(1)
  })

  it('cancels an unexecuted draft idempotently and never invokes the domain action', async () => {
    const { service, storage, domain } = setup()
    const prepared = await service.prepare(context, actionInput)

    const cancelled = await service.cancel(context, prepared.draft.id)
    expect(cancelled.draft).toMatchObject({ status: 'CANCELLED', version: prepared.draft.version + 1 })
    expect(storage.cancel).toHaveBeenCalledTimes(1)
    expect(domain.execute).not.toHaveBeenCalled()
    await expect(service.cancel(context, prepared.draft.id))
      .resolves.toMatchObject({ draft: { status: 'CANCELLED' } })
    expect(storage.cancel).toHaveBeenCalledTimes(1)
  })

  it('requires a successful-result retry to carry the original confirmation binding', async () => {
    const { service } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    await service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })

    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: '0'.repeat(64),
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_CONFLICT' })
  })

  it('keeps a failed confirmation or execution-start audit from reaching the HR domain write', async () => {
    const confirmFailure = setup()
    const firstDraft = await confirmFailure.service.prepare(context, actionInput)
    vi.mocked(confirmFailure.storage.confirm).mockRejectedValueOnce(
      new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503),
    )
    await expect(confirmFailure.service.confirm(context, {
      draftId: firstDraft.draft.id,
      expectedVersion: firstDraft.draft.version,
      expectedPreviewHash: String((firstDraft.draft.controlPayload as Record<string, Json>).previewHash),
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_STORAGE_UNAVAILABLE' })
    expect(confirmFailure.domain.execute).not.toHaveBeenCalled()

    const claimFailure = setup()
    const secondDraft = await claimFailure.service.prepare(context, actionInput)
    const previewHash = String((secondDraft.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await claimFailure.service.confirm(context, {
      draftId: secondDraft.draft.id,
      expectedVersion: secondDraft.draft.version,
      expectedPreviewHash: previewHash,
    })
    vi.mocked(claimFailure.storage.claim).mockRejectedValueOnce(
      new ControlledActionError('CONTROLLED_ACTION_STORAGE_UNAVAILABLE', 503),
    )
    await expect(claimFailure.service.execute(context, {
      draftId: secondDraft.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_STORAGE_UNAVAILABLE' })
    expect(claimFailure.domain.execute).not.toHaveBeenCalled()
  })

  it('reports readback failure without replaying a committed domain action', async () => {
    const { service, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    vi.mocked(domain.readback).mockRejectedValueOnce(new Error('readback unavailable'))

    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_READBACK_UNAVAILABLE' })
    await expect(service.readback(context, prepared.draft.id))
      .resolves.toMatchObject({ draft: { status: 'SUCCEEDED' }, readback: { status: 'DRAFT' } })
    expect(domain.execute).toHaveBeenCalledTimes(1)
  })

  it('rejects a changed preview and a changed actor permission set before execution', async () => {
    const { service, setPreviewMarker } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    setPreviewMarker('changed-domain-state')
    await expect(service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_PREVIEW_STALE' })

    const changedRoleSetup = setup()
    const roleBoundDraft = await changedRoleSetup.service.prepare(context, actionInput)
    const sameActorAfterRoleChange = { ...context, activeRoles: ['EMPLOYEE', 'DIRECT_MANAGER'] }
    await expect(changedRoleSetup.service.preview(sameActorAfterRoleChange, roleBoundDraft.draft.id))
      .rejects.toMatchObject({ code: 'CONTROLLED_ACTION_PREVIEW_STALE' })

    const changedGroupSetup = setup()
    const groupBoundDraft = await changedGroupSetup.service.prepare(context, actionInput)
    const sameActorAfterGroupChange = { ...context, hrGroupId: '10000000-0000-4000-8000-000000000009' }
    await expect(changedGroupSetup.service.preview(sameActorAfterGroupChange, groupBoundDraft.draft.id))
      .rejects.toMatchObject({ code: 'CONTROLLED_ACTION_PREVIEW_STALE' })
  })

  it('does not create a draft when central domain authorization denies prepare', async () => {
    const { service, storage } = setup(false)
    await expect(service.prepare(context, actionInput)).rejects.toMatchObject({ message: 'ACCESS_DENIED' })
    expect(storage.insert).not.toHaveBeenCalled()
  })

  it('rejects reuse of an idempotency key for a different payload', async () => {
    const { service } = setup()
    await service.prepare(context, actionInput)
    await expect(service.prepare(context, {
      ...actionInput,
      payload: { title: 'Ander doel', periodStart: '2026-10-01' },
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_CONFLICT' } satisfies Partial<ControlledActionError>)
  })

  it('rejects malformed keys and unknown actions before domain preview or draft storage', async () => {
    const { service, storage, domain } = setup()
    await expect(service.prepare(context, { ...actionInput, idempotencyKey: 'not-a-uuid' }))
      .rejects.toMatchObject({ code: 'CONTROLLED_ACTION_INPUT_INVALID', status: 400 })
    await expect(service.prepare(context, {
      ...actionInput,
      actionId: 'talent.unknown.create' as ControlledActionId,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_INPUT_INVALID', status: 400 })
    expect(domain.preview).not.toHaveBeenCalled()
    expect(storage.insert).not.toHaveBeenCalled()
  })

  it('rejects execution before confirmation and stale draft versions without claiming or writing', async () => {
    const { service, storage, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)

    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_NOT_EXECUTABLE' })

    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    await expect(service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version + 1,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_NOT_EXECUTABLE' })
    expect(storage.claim).not.toHaveBeenCalled()
    expect(domain.execute).not.toHaveBeenCalled()
  })

  it('rejects preview and execution after the 15-minute expiry boundary', async () => {
    const previewExpiry = setup()
    const previewDraft = await previewExpiry.service.prepare(context, actionInput)
    previewExpiry.setNow('2026-10-06T09:15:00.000Z')
    await expect(previewExpiry.service.preview(context, previewDraft.draft.id))
      .rejects.toMatchObject({ code: 'CONTROLLED_ACTION_EXPIRED' })

    const executeExpiry = setup()
    const executeDraft = await executeExpiry.service.prepare(context, actionInput)
    const previewHash = String((executeDraft.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await executeExpiry.service.confirm(context, {
      draftId: executeDraft.draft.id,
      expectedVersion: executeDraft.draft.version,
      expectedPreviewHash: previewHash,
    })
    executeExpiry.setNow('2026-10-06T09:15:00.000Z')
    await expect(executeExpiry.service.execute(context, {
      draftId: executeDraft.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_EXPIRED' })
    expect(executeExpiry.storage.claim).not.toHaveBeenCalled()
    expect(executeExpiry.domain.execute).not.toHaveBeenCalled()
  })

  it('does not permit cancellation after execution has committed', async () => {
    const { service, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    const executed = await service.execute(context, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })

    await expect(service.cancel(context, executed.draft.id))
      .rejects.toMatchObject({ code: 'CONTROLLED_ACTION_NOT_EXECUTABLE' })
    expect(domain.execute).toHaveBeenCalledTimes(1)
  })

  it('revalidates current permissions at execution instead of trusting the old preview', async () => {
    const { service, storage, domain } = setup()
    const prepared = await service.prepare(context, actionInput)
    const previewHash = String((prepared.draft.controlPayload as Record<string, Json>).previewHash)
    const confirmed = await service.confirm(context, {
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      expectedPreviewHash: previewHash,
    })
    const changedPermissionContext = { ...context, permissions: ['self:talent-goal:read'] }

    await expect(service.execute(changedPermissionContext, {
      draftId: prepared.draft.id,
      expectedVersion: confirmed.draft.version,
      expectedPreviewHash: previewHash,
    })).rejects.toMatchObject({ code: 'CONTROLLED_ACTION_PREVIEW_STALE' })
    expect(storage.claim).not.toHaveBeenCalled()
    expect(domain.execute).not.toHaveBeenCalled()
  })
})
