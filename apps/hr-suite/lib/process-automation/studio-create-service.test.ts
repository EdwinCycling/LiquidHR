import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
  requireHrGroupId: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return {
    ...actual,
    requirePermission: mocks.requirePermission,
    requireAnyPermission: mocks.requireAnyPermission,
    requireHrGroupId: mocks.requireHrGroupId,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { AuthorizationError } from '@/lib/auth/permissions'
import { createStudioDefinition, getStudioDefinition, saveStudioDefinition, type StudioDefinition } from './studio-service'
import { createTrainingRequestExampleDraft } from './studio-draft-factories'

const input = {
  key: 'training-request',
  title: { nl: 'Opleidingsaanvraag', en: 'Training request' },
  description: { nl: 'Aanvraag en beoordeling van een opleiding.', en: 'Request and review training.' },
  startingPoint: 'BLANK' as const,
}

describe('createStudioDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'group-1', userId: 'user-1', administrationId: null })
    mocks.requireHrGroupId.mockReturnValue('group-1')
    mocks.rpc.mockResolvedValue({ data: { id: '00000000-0000-4000-8000-000000000001', revision: 1 }, error: null })
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc })
  })

  it('persists the chosen name and description in a blank definition without copied workflow data', async () => {
    await createStudioDefinition(input)

    expect(mocks.requirePermission).toHaveBeenCalledWith('process-definition:write')
    expect(mocks.rpc).toHaveBeenCalledWith('create_process_definition_draft', expect.objectContaining({
      requested_key: input.key,
      requested_title: input.title,
      requested_description: input.description,
      requested_definition: expect.objectContaining({
        key: input.key,
        title: input.title,
        description: input.description,
        participants: [],
        forms: [],
        steps: [],
        transitions: [],
      }),
    }))
  })

  it('refuses a process draft for actors without process-definition:write before opening the data client', async () => {
    mocks.requirePermission.mockRejectedValue(new AuthorizationError('Geen beheertoegang.'))

    await expect(createStudioDefinition(input)).rejects.toThrow(AuthorizationError)
    expect(mocks.requirePermission).toHaveBeenCalledWith('process-definition:write')
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('persists edited typed steps, responsibility, and recovery routes for a later studio reopen', async () => {
    const definition = createTrainingRequestExampleDraft({
      key: 'training-request',
      title: input.title,
      description: input.description,
    })
    const recoveryRoute = definition.transitions.find((transition) => transition.action === 'REQUEST_CHANGES')
    if (!recoveryRoute) throw new Error('Example recovery route was not created')
    recoveryRoute.label = { nl: 'Aanvraag aanvullen', en: 'Complete the request' }
    definition.steps[1].participantKey = 'hr-team'

    mocks.rpc.mockResolvedValue({ data: { revision: 2 }, error: null })
    const result = await saveStudioDefinition('00000000-0000-4000-8000-000000000001', 1, definition)

    expect(result.revision).toBe(2)
    expect(result.issues).toEqual([])
    expect(mocks.rpc).toHaveBeenCalledWith('save_process_definition_draft', expect.objectContaining({
      requested_expected_revision: 1,
      requested_definition: expect.objectContaining({
        steps: expect.arrayContaining([expect.objectContaining({ key: 'manager-review', participantKey: 'hr-team' })]),
        transitions: expect.arrayContaining([expect.objectContaining({
          key: 'manager-changes',
          toStepKey: 'employee-request',
          kind: 'RECOVERY',
          label: { nl: 'Aanvraag aanvullen', en: 'Complete the request' },
        })]),
      }),
      requested_validation_report: { issues: [] },
    }))
  })

  it('reopens the stored draft with its edited route and responsible participant intact', async () => {
    const definition = createTrainingRequestExampleDraft({
      key: 'training-request',
      title: input.title,
      description: input.description,
    })
    const recoveryRoute = definition.transitions.find((transition) => transition.action === 'REQUEST_CHANGES')
    if (!recoveryRoute) throw new Error('Example recovery route was not created')
    recoveryRoute.label = { nl: 'Aanvraag aanvullen', en: 'Complete the request' }
    definition.steps[1].participantKey = 'hr-team'

    const definitionId = '00000000-0000-4000-8000-000000000001'
    const definitionRow = { id: definitionId } as unknown as StudioDefinition['definition']
    const responses: Record<string, { data: unknown; error: null }> = {
      process_definitions: { data: definitionRow, error: null },
      process_definition_drafts: { data: [{ revision: 2, definition_json: definition, validation_report: { issues: [] } }], error: null },
      process_versions: { data: [], error: null },
    }
    type Query = {
      select: () => Query
      eq: (column: string, value: string) => Query
      order: (column: string, options: { ascending: boolean }) => Query
      limit: (count: number) => Promise<{ data: unknown; error: null }>
      maybeSingle: () => Promise<{ data: unknown; error: null }>
    }
    const from = vi.fn((table: string) => {
      const response = responses[table]
      if (!response) throw new Error(`Unexpected table query: ${table}`)
      const query: Query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => response,
        maybeSingle: async () => response,
      }
      return query
    })
    mocks.requireAnyPermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'group-1', userId: 'user-1', administrationId: null })
    mocks.createClient.mockResolvedValue({ from } as never)

    const reopened = await getStudioDefinition(definitionId)

    expect(reopened.draftRevision).toBe(2)
    expect(reopened.draft).toEqual(definition)
  })

  it('denies studio reads before opening the data client when no read permission is present', async () => {
    mocks.requireAnyPermission.mockRejectedValue(new AuthorizationError('Geen studiotoegang.'))

    await expect(getStudioDefinition('00000000-0000-4000-8000-000000000001')).rejects.toThrow(AuthorizationError)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})
