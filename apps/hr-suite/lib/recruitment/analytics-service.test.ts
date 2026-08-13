import { describe, expect, it } from 'vitest'
import { buildRecruitmentAnalytics } from './analytics-service'

describe('guided recruitment analytics service', () => {
  it('blijft bruikbaar met een enkele actieve werkfase en publiceert alleen aggregates', () => {
    const analytics = buildRecruitmentAnalytics({
      vacancies: [{ id: 'v1', isOpen: true }],
      applications: [
        { vacancyId: 'v1', stage: 'Sollicitatie', outcome: null, source: 'WEBSITE', receivedAt: '2026-08-01T00:00:00.000Z', outcomeAt: null },
        { vacancyId: 'v1', stage: 'Sollicitatie', outcome: 'AANGENOMEN', source: 'MANUAL', receivedAt: '2026-07-01T00:00:00.000Z', outcomeAt: '2026-08-05T00:00:00.000Z' },
      ],
    })
    expect(analytics.global.activeApplications).toBe(1)
    expect(analytics.byVacancy[0]).toEqual(expect.objectContaining({ vacancyId: 'v1', totalApplications: 2, hired: 1 }))
    expect(JSON.stringify(analytics)).not.toContain('Sanne')
  })
})
