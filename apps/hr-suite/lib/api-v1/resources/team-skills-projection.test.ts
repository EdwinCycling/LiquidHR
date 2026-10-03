import { describe, expect, it } from 'vitest'
import type { TalentTeamMatrixCapability } from '@/lib/talent/team-model'
import { projectTeamSkills, type TeamSkillsProjection } from './team-skills-projection'

const capability = (overrides: Partial<TalentTeamMatrixCapability> = {}): TalentTeamMatrixCapability => ({
  id: 'internal-record-id',
  capability_id: 'internal-capability-id',
  status: 'RELEASED',
  source_type: 'HR_ENTERED',
  valid_from: '2026-08-01',
  valid_until: null,
  certificate_status: 'VALID',
  evidence_status: 'VERIFIED',
  certificate_code: 'PRIVATE-CERTIFICATE-CODE',
  capabilityName: 'Interne capability label',
  capabilityCode: 'SKILL-CUSTOMER',
  capabilityType: 'SKILL',
  ...overrides,
})

describe('Team Skills API candidate projection', () => {
  it('projects only the proposed candidate fields', () => {
    const projected = projectTeamSkills([capability()])

    expect(projected).toEqual<TeamSkillsProjection[]>([{
      capabilityCode: 'SKILL-CUSTOMER',
      capabilityType: 'SKILL',
      status: 'RELEASED',
      validFrom: '2026-08-01',
      validUntil: null,
    }])
    expect(Object.keys(projected[0] ?? {}).sort()).toEqual([
      'capabilityCode',
      'capabilityType',
      'status',
      'validFrom',
      'validUntil',
    ])
  })

  it('does not expose identifiers, labels, evidence or certificate data', () => {
    const projected = projectTeamSkills([capability()])
    const serialized = JSON.stringify(projected)

    expect(serialized).not.toContain('internal-record-id')
    expect(serialized).not.toContain('internal-capability-id')
    expect(serialized).not.toContain('Interne capability label')
    expect(serialized).not.toContain('PRIVATE-CERTIFICATE-CODE')
    expect(serialized).not.toContain('VERIFIED')
  })

  it('preserves service order and nullable validity end dates', () => {
    expect(projectTeamSkills([
      capability({ capabilityCode: 'SKILL-FIRST', valid_until: '2026-12-31' }),
      capability({ capabilityCode: 'SKILL-SECOND', valid_until: null }),
    ])).toEqual([
      {
        capabilityCode: 'SKILL-FIRST',
        capabilityType: 'SKILL',
        status: 'RELEASED',
        validFrom: '2026-08-01',
        validUntil: '2026-12-31',
      },
      {
        capabilityCode: 'SKILL-SECOND',
        capabilityType: 'SKILL',
        status: 'RELEASED',
        validFrom: '2026-08-01',
        validUntil: null,
      },
    ])
  })
})
