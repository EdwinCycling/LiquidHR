import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { AnalysisEngineError } from './analysis-errors'
import {
  createSavedAnalysis,
  deleteSavedAnalysis,
  getSavedAnalysis,
  listMySavedAnalyses,
  renameSavedAnalysis,
  updateSavedAnalysis,
  type SavedAnalysisPersistenceRow,
  type SavedAnalysisRepository,
} from './saved-analysis-service'

const analysisId = '11111111-1111-4111-8111-111111111111'
const otherAnalysisId = '22222222-2222-4222-8222-222222222222'
const spec = {
  version: 1,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: [],
  filters: [],
  sort: null,
  limit: 25,
  presentation: 'auto',
}

function auth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    administrationId: null,
    userId: 'user-a',
    employeeId: null,
    activeRoles: ['DIRECT_MANAGER'],
    permissions: ['dashboard:read'],
    ...overrides,
  }
}

function row(overrides: Partial<SavedAnalysisPersistenceRow> = {}): SavedAnalysisPersistenceRow {
  return {
    id: analysisId,
    tenant_id: 'tenant-a',
    hr_group_id: 'group-a',
    owner_user_id: 'user-a',
    name: 'Mijn analyse',
    analysis_spec: spec,
    definition_version: 1,
    created_at: '2026-08-30T12:00:00.000Z',
    updated_at: '2026-08-30T12:00:00.000Z',
    ...overrides,
  }
}

function repository(initialRows: readonly SavedAnalysisPersistenceRow[] = [row()]): SavedAnalysisRepository & { rows: SavedAnalysisPersistenceRow[] } {
  const rows = [...initialRows]
  const scopeMatches = (candidate: SavedAnalysisPersistenceRow, scope: { tenantId: string; hrGroupId: string; ownerUserId: string }) => {
    return candidate.tenant_id === scope.tenantId && candidate.hr_group_id === scope.hrGroupId && candidate.owner_user_id === scope.ownerUserId
  }
  return {
    rows,
    list: vi.fn(async (scope) => rows.filter((candidate) => scopeMatches(candidate, scope))),
    get: vi.fn(async (scope, id) => rows.find((candidate) => candidate.id === id && scopeMatches(candidate, scope)) ?? null),
    create: vi.fn(async (scope, input) => {
      const created = row({ id: otherAnalysisId, name: input.name, analysis_spec: input.analysisSpec, tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId, owner_user_id: scope.ownerUserId })
      rows.push(created)
      return created
    }),
    update: vi.fn(async (scope, id, input) => {
      const current = rows.find((candidate) => candidate.id === id && scopeMatches(candidate, scope))
      if (!current) return null
      const updated = { ...current, ...(input.name ? { name: input.name } : {}), ...(input.analysisSpec ? { analysis_spec: input.analysisSpec } : {}), updated_at: '2026-08-30T13:00:00.000Z' }
      Object.assign(current, updated)
      return current
    }),
    delete: vi.fn(async (scope, id) => {
      const index = rows.findIndex((candidate) => candidate.id === id && scopeMatches(candidate, scope))
      if (index < 0) return false
      rows.splice(index, 1)
      return true
    }),
  }
}

function dependencies(requestedAuth: AuthContext, requestedRepository: SavedAnalysisRepository) {
  return {
    getAuthorization: async () => ({ context: requestedAuth, supabase: {} as never }),
    repository: requestedRepository,
  }
}

describe('saved analysis service security contract', () => {
  it('lists only the server-derived owner, tenant and active HR-group scope', async () => {
    const requestedRepository = repository([
      row(),
      row({ id: otherAnalysisId, name: 'Andere analyse', owner_user_id: 'user-b' }),
    ])
    const result = await listMySavedAnalyses(dependencies(auth(), requestedRepository))

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Mijn analyse')
    expect(requestedRepository.list).toHaveBeenCalledWith({ tenantId: 'tenant-a', hrGroupId: 'group-a', ownerUserId: 'user-a' })
  })

  it('denies an actor without the existing analysis permission before persistence', async () => {
    const requestedRepository = repository()

    await expect(listMySavedAnalyses(dependencies(auth({ permissions: [] }), requestedRepository))).rejects.toBeInstanceOf(AuthorizationError)
    expect(requestedRepository.list).not.toHaveBeenCalled()
  })

  it('denies anonymous access before persistence', async () => {
    const requestedRepository = repository()
    const anonymousDependencies = {
      getAuthorization: async () => {
        throw new AuthenticationError('Je bent niet ingelogd.')
      },
      repository: requestedRepository,
    }

    await expect(listMySavedAnalyses(anonymousDependencies)).rejects.toBeInstanceOf(AuthenticationError)
    expect(requestedRepository.list).not.toHaveBeenCalled()
  })

  it('does not expose another owner or group through get, rename, update or delete', async () => {
    const requestedRepository = repository()

    await expect(getSavedAnalysis(analysisId, dependencies(auth({ userId: 'user-b' }), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_NOT_FOUND', status: 404 })
    await expect(renameSavedAnalysis(analysisId, 'Nieuwe naam', dependencies(auth({ hrGroupId: 'group-b' }), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_NOT_FOUND' })
    await expect(updateSavedAnalysis(analysisId, { analysisSpec: spec }, dependencies(auth({ tenantId: 'tenant-b' }), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_NOT_FOUND' })
    await expect(deleteSavedAnalysis(analysisId, dependencies(auth({ userId: 'user-b' }), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_NOT_FOUND' })
  })

  it('saves only a validated definition and never stores a result or employee rows', async () => {
    const requestedRepository = repository([])
    const result = await createSavedAnalysis({ name: '  Hoofdcount  ', analysisSpec: spec }, dependencies(auth(), requestedRepository))

    expect(result.name).toBe('Hoofdcount')
    expect(result.spec).toEqual(expect.objectContaining({ version: 1, entity: 'employees' }))
    expect(requestedRepository.create).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', hrGroupId: 'group-a', ownerUserId: 'user-a' },
      expect.objectContaining({ name: 'Hoofdcount', analysisSpec: expect.objectContaining({ version: 1 }) }),
    )
    const createCall = vi.mocked(requestedRepository.create).mock.calls[0]
    expect(JSON.stringify(createCall?.[1])).not.toContain('employee-')
    expect(JSON.stringify(createCall?.[1])).not.toContain('result')
  })

  it('fails closed for a malformed persisted spec and unsupported client spec', async () => {
    const requestedRepository = repository([row({ analysis_spec: { ...spec, version: 2 } })])

    await expect(getSavedAnalysis(analysisId, dependencies(auth(), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_DEFINITION_INVALID', status: 500 })
    await expect(createSavedAnalysis({ name: 'Ongeldig', analysisSpec: { ...spec, source: 'employees' } }, dependencies(auth(), repository([])))).rejects.toBeInstanceOf(AnalysisEngineError)
  })

  it('updates and renames through the same scoped write seam', async () => {
    const requestedRepository = repository()

    await expect(renameSavedAnalysis(analysisId, '  Hernoemd  ', dependencies(auth(), requestedRepository))).resolves.toMatchObject({ name: 'Hernoemd' })
    await expect(updateSavedAnalysis(analysisId, { analysisSpec: { ...spec, dimensions: ['department'], presentation: 'table' } }, dependencies(auth(), requestedRepository))).resolves.toMatchObject({ spec: { dimensions: ['department'] } })
    await expect(deleteSavedAnalysis(analysisId, dependencies(auth(), requestedRepository))).resolves.toBe(true)
  })

  it('rejects malformed identifiers before the repository call', async () => {
    const requestedRepository = repository()

    await expect(getSavedAnalysis('not-a-uuid', dependencies(auth(), requestedRepository))).rejects.toMatchObject({ code: 'SAVED_ANALYSIS_INVALID_ID', status: 400 })
    expect(requestedRepository.get).not.toHaveBeenCalled()
  })
})
