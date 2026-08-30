import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AuthorizationError } from '@/lib/auth/permissions'
import * as aiUsageReport from '@/lib/insights/ai-usage-report'
import { GET } from './route'

describe('GET /api/insights/ai-usage', () => {
  it('rejects a request without the canonical report selector', async () => {
    const response = await GET(new Request('http://localhost/api/insights/ai-usage?report=other'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INSIGHTS_AI_USAGE_QUERY_INVALID' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns the server-side authorization response for a denied context', async () => {
    const getReport = vi.spyOn(aiUsageReport, 'getAiUsageReport').mockRejectedValue(new AuthorizationError('Denied'))
    const response = await GET(new Request('http://localhost/api/insights/ai-usage?report=ai-usage&period=this-month'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Denied' })
    expect(getReport).toHaveBeenCalledWith({ report: 'ai-usage', period: 'this-month' })
    getReport.mockRestore()
  })
})
