import { describe, expect, it } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentGoal, TalentGoalWorkspace } from '@/lib/talent/goal-service'
import {
  ApiResourceProjectionError,
  projectSelfDevelopmentPlans,
  projectWorkforceSummary,
  teamSkillsApiStatus,
} from './projections'

const authContext = (employeeId: string | null, tenantId = 'internal-tenant-id'): Pick<AuthContext, 'tenantId' | 'employeeId'> => ({ tenantId, employeeId })

const goal = (overrides: Partial<TalentGoal> = {}): TalentGoal => ({
  id: 'internal-goal-id',
  tenant_id: 'internal-tenant-id',
  employee_id: 'self-employee-id',
  capability_id: 'internal-capability-id',
  title: 'Sensitive free text',
  description: 'Sensitive free text',
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  progress_percent: 35,
  status: 'ACTIVE',
  source_type: 'SELF_ENTERED',
  version: 4,
  completed_at: null,
  archived_at: null,
  employeeLabel: 'Private employee label',
  capabilityLabel: 'Private capability label',
  ...overrides,
})

const workspace = (goals: TalentGoal[]): Pick<TalentGoalWorkspace, 'goals'> => ({ goals })

describe('API v1 resource projections', () => {
  it('projects only the server-selected Workforce Summary date', () => {
    expect(projectWorkforceSummary(new Date('2026-10-03T08:30:00.000Z'))).toEqual({ asOfDate: '2026-10-03' })
  })

  it('rejects an invalid server clock value', () => {
    expect(() => projectWorkforceSummary(new Date(Number.NaN))).toThrowError(ApiResourceProjectionError)
  })

  it('projects only allowlisted, self-scoped development-plan fields', () => {
    const projected = projectSelfDevelopmentPlans(authContext('self-employee-id'), workspace([goal()]))

    expect(projected).toEqual([{
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      progressPercent: 35,
      status: 'ACTIVE',
      completedAt: null,
    }])
    expect(JSON.stringify(projected)).not.toContain('internal-goal-id')
    expect(JSON.stringify(projected)).not.toContain('internal-tenant-id')
    expect(JSON.stringify(projected)).not.toContain('self-employee-id')
    expect(JSON.stringify(projected)).not.toContain('Sensitive free text')
  })

  it('fails closed when the active context has no employee', () => {
    expect(() => projectSelfDevelopmentPlans(authContext(null), workspace([]))).toThrowError(
      expect.objectContaining({ code: 'SELF_CONTEXT_REQUIRED' }),
    )
  })

  it('fails closed when a service result contains another employee', () => {
    expect(() => projectSelfDevelopmentPlans(authContext('self-employee-id'), workspace([
      goal({ employee_id: 'other-employee-id' }),
    ]))).toThrowError(expect.objectContaining({ code: 'SELF_SCOPE_MISMATCH' }))
  })

  it('fails closed when a service result belongs to another tenant', () => {
    expect(() => projectSelfDevelopmentPlans(authContext('self-employee-id'), workspace([
      goal({ tenant_id: 'other-tenant-id' }),
    ]))).toThrowError(expect.objectContaining({ code: 'SELF_SCOPE_MISMATCH' }))
  })

  it('fails closed when a service result contains an unknown status', () => {
    expect(() => projectSelfDevelopmentPlans(authContext('self-employee-id'), workspace([
      goal({ status: 'UNREVIEWED' }),
    ]))).toThrowError(expect.objectContaining({ code: 'INVALID_DEVELOPMENT_PLAN' }))
  })

  it('keeps Team Skills externally deferred pending privacy review', () => {
    expect(teamSkillsApiStatus).toBe('DEFERRED_PRIVACY_REVIEW')
  })
})
