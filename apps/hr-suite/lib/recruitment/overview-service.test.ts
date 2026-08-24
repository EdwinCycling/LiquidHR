import { describe, expect, it } from 'vitest'
import { getRecruitmentOverviewCapabilities, parseRecruitmentOverviewAnalytics } from './overview-service'

describe('recruitment overview service', () => {
  it('valideert uitsluitend de aggregate analytics die het overview-contract levert', () => {
    const analytics = parseRecruitmentOverviewAnalytics({
      global: { openVacancies: 2, activeApplications: 4, newApplications: 1 },
      byVacancy: [{ vacancyId: 'vacancy-1', totalApplications: 5, newApplications: 2, rejected: 1, hired: 2 }],
    })

    expect(analytics.global.activeApplications).toBe(4)
    expect(analytics.byVacancy[0]).toEqual(expect.objectContaining({ vacancyId: 'vacancy-1', hired: 2 }))
    expect(() => parseRecruitmentOverviewAnalytics({
      global: { openVacancies: 2, activeApplications: 4, newApplications: 1, candidateName: 'Sanne' },
      byVacancy: [],
    })).toThrow()
  })

  it('laat vacatureacties en participant-links alleen zien bij het bestaande permissioncontract', () => {
    expect(getRecruitmentOverviewCapabilities([
      'recruitment-candidate:read',
      'recruitment-vacancy:write',
      'recruitment-settings:manage',
      'recruitment-participation:read',
    ])).toEqual({ canCreateVacancy: true, canManageSettings: true, canReadCandidates: true, canReadAssigned: true })
    expect(getRecruitmentOverviewCapabilities(['recruitment-vacancy:read'])).toEqual({ canCreateVacancy: false, canManageSettings: false, canReadCandidates: false, canReadAssigned: false })
  })
})
