import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AuthorizationError } from '@/lib/auth/permissions'
import * as absenceReport from '@/lib/insights/absence-report'
import * as bradfordReport from '@/lib/insights/bradford-report'
import * as frequentAbsenceReport from '@/lib/insights/frequent-absence-report'
import { GET } from './route'

describe('GET /api/insights/absence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the server authorization response for report and Excel requests', async () => {
    const denied = new AuthorizationError('Denied')
    const absence = vi.spyOn(absenceReport, 'getAbsenceInsightReport').mockRejectedValue(denied)
    const frequent = vi.spyOn(frequentAbsenceReport, 'getFrequentAbsenceReport').mockRejectedValue(denied)
    const bradford = vi.spyOn(bradfordReport, 'getBradfordInsightReport').mockRejectedValue(denied)

    const responses = await Promise.all([
      GET(new Request('http://localhost/api/insights/absence?report=absence&period=month&year=2025&month=2')),
      GET(new Request('http://localhost/api/insights/absence?report=absence&format=excel&period=month&year=2025&month=2')),
      GET(new Request('http://localhost/api/insights/absence?report=absence-frequent&period=12-months')),
      GET(new Request('http://localhost/api/insights/absence?report=absence-frequent&period=12-months&format=excel')),
      GET(new Request('http://localhost/api/insights/absence?report=absence-bradford&period=52-weeks')),
      GET(new Request('http://localhost/api/insights/absence?report=absence-bradford&period=52-weeks&format=excel')),
    ])

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403])
    for (const response of responses) expect(await response.json()).toEqual({ error: 'Denied' })
    expect(absence).toHaveBeenCalledTimes(2)
    expect(frequent).toHaveBeenCalledTimes(2)
    expect(bradford).toHaveBeenCalledTimes(2)
  })
})
