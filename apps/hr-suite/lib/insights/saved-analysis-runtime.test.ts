import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { executeSavedAnalysis } from './saved-analysis-runtime'
import type { SavedAnalysisPersistenceRow, SavedAnalysisRepository } from './saved-analysis-service'

const analysisId = '11111111-1111-4111-8111-111111111111'
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

const row: SavedAnalysisPersistenceRow = {
  id: analysisId,
  tenant_id: 'tenant-a',
  hr_group_id: 'group-a',
  owner_user_id: 'user-a',
  name: 'Actieve medewerkers',
  analysis_spec: spec,
  definition_version: 1,
  created_at: '2026-08-30T12:00:00.000Z',
  updated_at: '2026-08-30T12:00:00.000Z',
}

const auth: AuthContext = {
  tenantId: 'tenant-a',
  hrGroupId: 'group-a',
  administrationId: null,
  userId: 'user-a',
  employeeId: null,
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['dashboard:read'],
}

const repository: SavedAnalysisRepository = {
  list: async () => [row],
  get: async () => row,
  create: async () => row,
  update: async () => row,
  delete: async () => true,
}

describe('saved analysis runtime', () => {
  it('validates and re-runs the saved definition through the existing engine seam', async () => {
    const execute = vi.fn(async () => ({
      version: 1 as const,
      source: 'workforce' as const,
      entity: 'employees' as const,
      measures: ['headcount'] as const,
      dimensions: [],
      metadata: { matchedRecordCount: 3, groupCount: 0 },
      columns: [{ key: 'headcount' as const, dataType: 'integer' as const }],
      rows: [{ values: { headcount: 3 } }],
      summary: { headcount: 3 },
      presentationHints: { preferred: 'kpi' as const, fallback: 'table' as const },
    }))

    const opened = await executeSavedAnalysis(analysisId, {
      execute,
      getAuthorization: async () => ({ context: auth, supabase: {} as never }),
      repository,
    })

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ version: 1, source: 'workforce', entity: 'employees' }))
    expect(opened.definition.name).toBe('Actieve medewerkers')
    expect(opened.result.summary).toEqual({ headcount: 3 })
    expect(JSON.stringify(opened.result)).not.toContain('employee-')
  })

  it('reopens the same definition against current data instead of a saved result snapshot', async () => {
    let currentHeadcount = 3
    const execute = vi.fn(async () => ({
      version: 1 as const,
      source: 'workforce' as const,
      entity: 'employees' as const,
      measures: ['headcount'] as const,
      dimensions: [],
      metadata: { matchedRecordCount: currentHeadcount, groupCount: 0 },
      columns: [{ key: 'headcount' as const, dataType: 'integer' as const }],
      rows: [{ values: { headcount: currentHeadcount } }],
      summary: { headcount: currentHeadcount },
      presentationHints: { preferred: 'kpi' as const, fallback: 'table' as const },
    }))

    const firstOpen = await executeSavedAnalysis(analysisId, {
      execute,
      getAuthorization: async () => ({ context: auth, supabase: {} as never }),
      repository,
    })

    currentHeadcount = 4
    const secondOpen = await executeSavedAnalysis(analysisId, {
      execute,
      getAuthorization: async () => ({ context: auth, supabase: {} as never }),
      repository,
    })

    expect(firstOpen.result.summary).toEqual({ headcount: 3 })
    expect(secondOpen.result.summary).toEqual({ headcount: 4 })
    expect(execute).toHaveBeenCalledTimes(2)
    expect(secondOpen.definition.spec).toEqual(firstOpen.definition.spec)
  })
})
