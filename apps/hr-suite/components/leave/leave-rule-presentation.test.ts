import { describe, expect, it } from 'vitest'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { currentRulesForProfile, profilesUsingLeaveType } from './leave-rule-presentation'

const catalog = {
  leaveTypes: [
    { id: 'type-b', name: 'Bovenwettelijk verlof' },
    { id: 'type-a', name: 'Wettelijk verlof' },
  ],
  profiles: [
    { id: 'profile-default', name: 'Standaard verlof Planeten' },
    { id: 'profile-alt', name: 'Test afwijkend verlofprofiel' },
  ],
  accrualRules: [
    { id: 'old-a', leave_profile_id: 'profile-default', leave_type_id: 'type-a', valid_from: '2025-01-01', valid_until: '2025-12-31' },
    { id: 'current-a', leave_profile_id: 'profile-default', leave_type_id: 'type-a', valid_from: '2026-01-01', valid_until: null },
    { id: 'future-b', leave_profile_id: 'profile-default', leave_type_id: 'type-b', valid_from: '2027-01-01', valid_until: null },
    { id: 'current-b', leave_profile_id: 'profile-alt', leave_type_id: 'type-b', valid_from: '2026-01-01', valid_until: null },
  ],
} as unknown as LeaveCatalog

describe('leave rule presentation', () => {
  it('returns the latest effective rule per leave type for a profile', () => {
    const rules = currentRulesForProfile(catalog, 'profile-default', '2026-09-12')

    expect(rules.map((rule) => rule.id)).toEqual(['current-a'])
  })

  it('returns profiles that currently use a leave type without duplicates', () => {
    expect(profilesUsingLeaveType(catalog, 'type-b', '2026-09-12').map((profile) => profile.name)).toEqual(['Test afwijkend verlofprofiel'])
  })
})
