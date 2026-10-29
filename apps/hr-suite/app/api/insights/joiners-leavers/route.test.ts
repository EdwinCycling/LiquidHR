import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinersLeaversServiceError, type JoinersLeaversReport } from '@/lib/insights/joiners-leavers-service'

const mocks = vi.hoisted(() => ({ csv: vi.fn(), permission: vi.fn(), report: vi.fn() }))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permission }))
vi.mock('@/lib/insights/joiners-leavers-service', () => ({
  getJoinersLeaversReport: mocks.report,
  JoinersLeaversServiceError: class JoinersLeaversServiceError extends Error {
    constructor(readonly code: string, readonly status = 500) { super(code) }
  },
}))
vi.mock('@/lib/insights/joiners-leavers-csv', () => ({ joinersLeaversCsv: mocks.csv }))

import { GET } from './route'

const report: JoinersLeaversReport = {
  report: 'joiners-leavers', audience: 'HR_ADMIN', period: { fromMonth: '2025-01', toMonth: '2025-02', allHistoryThroughMonth: '2026-09' },
  summary: {
    employmentStarts: 0, employeesWithStart: 0, employeesEnteringScope: 0, employmentEnds: 0, employeesWithEnd: 0,
    employeesLeavingScope: 0, terminationWorkflowEvents: 0, softDeletedReconciliations: 0,
    unavailableEmploymentReconciliations: 0, terminationDateMismatches: 0,
  },
  trend: [], reconciliation: { softDeletedEmploymentTerminations: 0, unavailableEmploymentTerminations: 0 }, rows: [],
  administrationOptions: [], departmentOptions: [], teamOptions: [],
}

describe('Joiners & Leavers API route', () => {
  beforeEach(() => {
    mocks.csv.mockReset()
    mocks.permission.mockReset().mockReturnValue(null)
    mocks.report.mockReset().mockResolvedValue(report)
  })

  it('rejects an unsupported report period before reading source data', async () => {
    const response = await GET(new Request('http://localhost/api/insights/joiners-leavers?report=joiners-leavers&fromMonth=2020-01&toMonth=2020-02'))
    expect(response.status).toBe(400)
    expect(mocks.report).not.toHaveBeenCalled()
  })

  it('returns the canonical report with private response caching', async () => {
    const response = await GET(new Request('http://localhost/api/insights/joiners-leavers?report=joiners-leavers&fromMonth=2025-01&toMonth=2025-02&page=2'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ data: report })
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: '2025-01', toMonth: '2025-02', page: 2 }))
  })

  it('exports localized CSV with the complete report range', async () => {
    mocks.csv.mockReturnValue('\uFEFFsep=;\r\nMedewerkernr;Medewerker')
    const response = await GET(new Request('http://localhost/api/insights/joiners-leavers?report=joiners-leavers&fromMonth=2025-01&toMonth=2025-02&format=csv&locale=nl'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('joiners-leavers-2025-02.csv')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.csv).toHaveBeenCalledWith(report, 'nl')
  })

  it('preserves authorization failures as a 403 response', async () => {
    mocks.report.mockRejectedValue(new JoinersLeaversServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403))
    const response = await GET(new Request('http://localhost/api/insights/joiners-leavers?report=joiners-leavers&fromMonth=2025-01&toMonth=2025-02'))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'INSIGHTS_SCOPE_LIMIT_REACHED' })
  })
})
