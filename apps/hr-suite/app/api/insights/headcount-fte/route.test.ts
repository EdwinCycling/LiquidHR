import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeadcountFteServiceError, type HeadcountFteReport } from '@/lib/insights/headcount-fte-service'

const mocks = vi.hoisted(() => ({
  csv: vi.fn(),
  permission: vi.fn(),
  report: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permission }))
vi.mock('@/lib/insights/headcount-fte-service', () => ({
  getHeadcountFteReport: mocks.report,
  HeadcountFteServiceError: class HeadcountFteServiceError extends Error {
    constructor(readonly code: string, readonly status = 500) { super(code) }
  },
}))
vi.mock('@/lib/insights/headcount-fte-csv', () => ({ headcountFteCsv: mocks.csv }))

import { GET } from './route'

const report: HeadcountFteReport = {
  report: 'headcount-fte', period: { fromMonth: '2025-01', toMonth: '2025-02', asOf: '2025-02-28' }, headcount: 0, fte: 0, knownFte: 0,
  activeEmploymentCount: 0, completeScheduleCount: 0, incompleteScheduleCount: 0, unassignedPlacementCount: 0, trend: [], rows: [],
  administrationOptions: [], departmentOptions: [], teamOptions: [],
}

describe('Headcount & FTE API route', () => {
  beforeEach(() => {
    mocks.csv.mockReset()
    mocks.permission.mockReset().mockReturnValue(null)
    mocks.report.mockReset().mockResolvedValue(report)
  })

  it('rejects invalid report periods before loading source data', async () => {
    const response = await GET(new Request('http://localhost/api/insights/headcount-fte?report=headcount-fte&fromMonth=2020-01&toMonth=2020-02'))
    expect(response.status).toBe(400)
    expect(mocks.report).not.toHaveBeenCalled()
  })

  it('returns the canonical report as a private JSON response', async () => {
    const response = await GET(new Request('http://localhost/api/insights/headcount-fte?report=headcount-fte&fromMonth=2025-01&toMonth=2025-02&page=2'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ data: report })
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: '2025-01', toMonth: '2025-02', page: 2 }))
  })

  it('exports the same report through the safe localized CSV response', async () => {
    mocks.csv.mockReturnValue('\uFEFFsep=;\r\nEmployee no.;Employee')
    const response = await GET(new Request('http://localhost/api/insights/headcount-fte?report=headcount-fte&fromMonth=2025-01&toMonth=2025-02&format=csv&locale=en'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('headcount-fte-2025-02.csv')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.csv).toHaveBeenCalledWith(report, 'en')
  })

  it('preserves a service authorization failure as a 403 response', async () => {
    mocks.report.mockRejectedValue(new HeadcountFteServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403))
    const response = await GET(new Request('http://localhost/api/insights/headcount-fte?report=headcount-fte&fromMonth=2025-01&toMonth=2025-02'))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'INSIGHTS_SCOPE_LIMIT_REACHED' })
  })
})
