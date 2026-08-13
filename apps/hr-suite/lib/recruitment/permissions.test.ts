import { describe, expect, it } from 'vitest'
import { canReadApplication, canWriteAssessment, revokeParticipationsForTerminalTransition } from './permissions'
import type { ApplicationProjection, RecruitmentActorContext } from './domain'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const applicationId = '33333333-3333-4333-8333-333333333333'

function actor(overrides: Partial<RecruitmentActorContext> = {}): RecruitmentActorContext {
  return {
    userId: '44444444-4444-4444-8444-444444444444',
    employeeId: '55555555-5555-4555-8555-555555555555',
    tenantId,
    hrGroupId,
    permissions: [],
    ...overrides,
  }
}

function application(overrides: Partial<ApplicationProjection> = {}): ApplicationProjection {
  return {
    id: applicationId,
    tenantId,
    hrGroupId,
    state: { kind: 'ACTIVE', stageId: '66666666-6666-4666-8666-666666666666', version: 1 },
    participations: [],
    ...overrides,
  }
}

describe('recruitment authorization projection', () => {
  it('geeft HR alleen toegang bij dezelfde tenant, HR-groep en exact recht', () => {
    const hr = actor({ permissions: ['recruitment-candidate:read'] })
    expect(canReadApplication(hr, application())).toBe(true)
    expect(canReadApplication({ ...hr, hrGroupId: '77777777-7777-4777-8777-777777777777' }, application())).toBe(false)
    expect(canReadApplication({ ...hr, tenantId: '88888888-8888-4888-8888-888888888888' }, application())).toBe(false)
    expect(canReadApplication(actor(), application())).toBe(false)
  })

  it('geeft uitsluitend een concrete actieve deelnemer toegang tot de toegewezen applicatie', () => {
    const participant = actor({ permissions: ['recruitment-participation:read', 'recruitment-participation:write'] })
    const assigned = application({ participations: [{ employeeId: participant.employeeId!, status: 'ACTIVE', capabilities: ['APPLICATION_READ', 'ASSESSMENT_WRITE'] }] })
    expect(canReadApplication(participant, assigned)).toBe(true)
    expect(canReadApplication(participant, { ...assigned, id: '99999999-9999-4999-8999-999999999999', participations: [] })).toBe(false)
    expect(canWriteAssessment(participant, assigned)).toBe(true)
  })

  it('trekt deelnemers atomair in en heropening herstelt ze niet', () => {
    const revoked = revokeParticipationsForTerminalTransition([
      { employeeId: '55555555-5555-4555-8555-555555555555', status: 'ACTIVE', capabilities: ['APPLICATION_READ'] },
      { employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ASSIGNED', capabilities: ['ASSESSMENT_WRITE'] },
    ])
    expect(revoked).toEqual([
      { employeeId: '55555555-5555-4555-8555-555555555555', status: 'REVOKED', capabilities: ['APPLICATION_READ'] },
      { employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'REVOKED', capabilities: ['ASSESSMENT_WRITE'] },
    ])
    expect(canReadApplication(actor({ permissions: ['recruitment-participation:read'] }), application({ participations: revoked }))).toBe(false)
  })
})
