import { describe, expect, it } from 'vitest'
import { getProfileActivationIssues, getProfileVersionPeriodState, type ProfileCapabilityReference, type ProfileRequirementReference } from './profile-management'

describe('profile version periods', () => {
  it('distinguishes current, planned, expired, and draft versions', () => {
    expect(getProfileVersionPeriodState({ status: 'ACTIVE', valid_from: '2026-10-01', valid_until: null }, '2026-10-16')).toBe('CURRENT')
    expect(getProfileVersionPeriodState({ status: 'ACTIVE', valid_from: '2026-11-01', valid_until: null }, '2026-10-16')).toBe('PLANNED')
    expect(getProfileVersionPeriodState({ status: 'ACTIVE', valid_from: '2026-09-01', valid_until: '2026-10-01' }, '2026-10-16')).toBe('INACTIVE')
    expect(getProfileVersionPeriodState({ status: 'DRAFT', valid_from: null, valid_until: null }, '2026-10-16')).toBe('DRAFT')
  })
})

describe('profile activation checklist', () => {
  const capabilities: ProfileCapabilityReference[] = [
    { id: 'competency', capability_type: 'COMPETENCY', status: 'ACTIVE' },
    { id: 'language', capability_type: 'LANGUAGE', status: 'ACTIVE' },
    { id: 'certificate', capability_type: 'CERTIFICATE', status: 'ACTIVE' },
    { id: 'inactive', capability_type: 'SKILL', status: 'INACTIVE' },
  ]
  const requirement = (id: string, capabilityId: string, fields: Partial<ProfileRequirementReference> = {}): ProfileRequirementReference => ({
    id,
    capability_id: capabilityId,
    target_level_id: null,
    language_level: null,
    certificate_details: null,
    ...fields,
  })

  it('requires tenant levels for leveled capabilities and CEFR for languages', () => {
    const issues = getProfileActivationIssues({
      validFrom: '2026-10-16',
      validUntil: null,
      requirements: [requirement('r1', 'competency'), requirement('r2', 'language')],
      capabilities,
      levelIds: new Set(['level-1']),
    })
    expect(issues).toEqual([
      { code: 'LEVEL_REQUIRED', requirementId: 'r1' },
      { code: 'LANGUAGE_LEVEL_REQUIRED', requirementId: 'r2' },
    ])
  })

  it('accepts a valid level, CEFR requirement, and certificate without a talent level', () => {
    const issues = getProfileActivationIssues({
      validFrom: '2026-10-16',
      validUntil: null,
      requirements: [
        requirement('r1', 'competency', { target_level_id: 'level-1' }),
        requirement('r2', 'language', { language_level: 'B2' }),
        requirement('r3', 'certificate'),
      ],
      capabilities,
      levelIds: new Set(['level-1']),
    })
    expect(issues).toEqual([])
  })

  it('blocks inactive or missing references, invalid periods, and a certificate talent level', () => {
    const issues = getProfileActivationIssues({
      validFrom: '2026-10-16',
      validUntil: '2026-10-16',
      requirements: [
        requirement('r1', 'inactive'),
        requirement('r2', 'missing'),
        requirement('r3', 'certificate', { target_level_id: 'level-1' }),
      ],
      capabilities,
      levelIds: new Set(['level-1']),
    })
    expect(issues).toEqual([
      { code: 'DATE_RANGE_INVALID' },
      { code: 'CAPABILITY_INACTIVE', requirementId: 'r1' },
      { code: 'LEVEL_REQUIRED', requirementId: 'r1' },
      { code: 'CAPABILITY_NOT_FOUND', requirementId: 'r2' },
      { code: 'LEVEL_NOT_ALLOWED', requirementId: 'r3' },
    ])
  })
})