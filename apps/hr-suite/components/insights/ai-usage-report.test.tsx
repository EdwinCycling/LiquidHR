import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AiUsageReportView, type AiUsageLabels } from './ai-usage-report'
import type { AiUsageReport } from '@/lib/insights/ai-usage-types'

vi.mock('next/navigation', () => ({
  usePathname: () => '/insights',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('report=ai-usage&period=this-month'),
}))

const labels: AiUsageLabels = {
  title: 'AI usage', description: 'Operational overview', period: 'Period', periodThisMonth: 'This month', periodLast7Days: 'Last 7 days', periodLast30Days: 'Last 30 days', periodLast90Days: 'Last 90 days', periodNote: 'Requests on receipt; credits on settlement.', creditsRemaining: 'Credits remaining', creditsUsed: 'Credits used', requests: 'Requests', successRate: 'Success rate', notAvailable: 'Not available', credits: 'credits', requestUnit: 'request', requestsUnit: 'requests', usageTrend: 'Usage over time', capabilities: 'Capabilities', quality: 'Quality', status: 'Status', successful: 'Successful', failed: 'Failed', rejected: 'Rejected', inProgress: 'In progress', otherStatus: 'Other', improveText: 'Improve text', otherCapability: 'Other capability', efficient: 'Efficient', balanced: 'Balanced', inDepth: 'In-depth', unknown: 'Unknown', completedRequests: 'Completed requests', noUsageTitle: 'No AI usage', noUsageDescription: 'No usage found.', creditsAccountingNote: 'Settled credits only.',
}

const baseReport: AiUsageReport = {
  report: 'ai-usage',
  period: { key: 'this-month', startDate: '2026-08-01', endDate: '2026-08-31' },
  creditsRemaining: 12,
  creditsUsed: 3,
  requests: 2,
  successRate: 100,
  trend: [{ date: '2026-08-01', creditsUsed: 3, requests: 2 }],
  byFeature: [{ key: 'IMPROVE_TEXT', requests: 2, creditsUsed: 3 }],
  byQuality: [{ key: 'BALANCED', requests: 2, creditsUsed: 3 }],
  byStatus: [{ key: 'SUCCEEDED', requests: 2, creditsUsed: 3 }],
}

describe('AI usage report view', () => {
  it('renders safe KPIs, breakdowns and trend without source metadata', () => {
    const markup = renderToStaticMarkup(<AiUsageReportView labels={labels} locale="en-US" query={{ report: 'ai-usage', period: 'this-month' }} report={baseReport} />)

    expect(markup).toContain('Credits remaining')
    expect(markup).toContain('Capabilities')
    expect(markup).toContain('Improve text')
    expect(markup).toContain('Usage over time')
    expect(markup).toContain('aria-label="Usage over time"')
    expect(markup).not.toMatch(/prompt|input|output|provider|model|requestId|employeeId/i)
  })

  it('renders an explicit empty state for a period without usage', () => {
    const emptyReport = { ...baseReport, creditsUsed: 0, requests: 0, successRate: null, byFeature: [], byQuality: [], byStatus: [], trend: [{ date: '2026-08-01', creditsUsed: 0, requests: 0 }] }
    const markup = renderToStaticMarkup(<AiUsageReportView labels={labels} locale="en-US" query={{ report: 'ai-usage', period: 'this-month' }} report={emptyReport} />)

    expect(markup).toContain('No AI usage')
    expect(markup).toContain('No usage found.')
  })
})
