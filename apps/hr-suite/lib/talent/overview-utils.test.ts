import { describe, expect, it } from 'vitest'
import type { TalentWorkforceProfile } from './service'
import { filterTalentWorkforceProfiles, talentNotificationActionHref, uniqueTalentWorkforceEmployees } from './overview-utils'

function profile(id: string, code: string, employees: TalentWorkforceProfile['employees']): TalentWorkforceProfile {
  return {
    profile: { job_profile_id: id, job_id: `job-${id}`, job_code: code, job_group_name: `${code} group`, job_family_name: 'Operations', seniority_name: 'Medior', summary: 'Customer support' } as TalentWorkforceProfile['profile'],
    requirements: [],
    employees,
  }
}

describe('Talent overview utilities', () => {
  const employees = [
    { id: 'employee-2', label: 'Zoe Janssen', employeeNumber: '1002', jobId: 'job-profile-2' },
    { id: 'employee-1', label: 'Ada Jansen', employeeNumber: '1001', jobId: 'job-profile-1' },
  ]
  const profiles = [profile('profile-1', 'OPS-01', [employees[1]]), profile('profile-2', 'OPS-02', [employees[0]])]

  it('filters profiles by employee and profile context', () => {
    expect(filterTalentWorkforceProfiles(profiles, '', 'employee-1').map((item) => item.profile.job_code)).toEqual(['OPS-01'])
    expect(filterTalentWorkforceProfiles(profiles, 'zoe', '').map((item) => item.profile.job_code)).toEqual(['OPS-02'])
  })

  it('deduplicates employees and keeps the selector stable by label', () => {
    const result = uniqueTalentWorkforceEmployees([profile('profile-1', 'OPS-01', employees), profile('profile-2', 'OPS-02', [employees[0]])])
    expect(result.map((employee) => employee.id)).toEqual(['employee-1', 'employee-2'])
  })

  it('maps notifications to existing Talent drilldowns only', () => {
    expect(talentNotificationActionHref('GOAL_OPEN')).toBe('/workforce/talent/goals')
    expect(talentNotificationActionHref('ASSESSMENT_PENDING')).toBe('/workforce/talent/assessments')
    expect(talentNotificationActionHref('UNKNOWN_EVENT')).toBeNull()
  })
})
