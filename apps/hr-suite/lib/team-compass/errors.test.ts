import { describe, expect, it } from 'vitest'
import { teamCompassDatabaseErrorStatus } from './errors'

describe('Teamkompas databasefoutstatussen', () => {
  it('returns conflict for locked and version-conflict transitions', () => {
    expect(teamCompassDatabaseErrorStatus({ message: 'TEAM_COMPASS_CAMPAIGN_LOCKED' })).toBe(409)
    expect(teamCompassDatabaseErrorStatus({ message: 'TEAM_COMPASS_VERSION_CONFLICT' })).toBe(409)
  })

  it('keeps forbidden and invalid errors fail-closed', () => {
    expect(teamCompassDatabaseErrorStatus({ message: 'TEAM_COMPASS_FORBIDDEN', code: '42501' })).toBe(403)
    expect(teamCompassDatabaseErrorStatus({ message: 'TEAM_COMPASS_ANSWERS_INCOMPLETE' })).toBe(400)
  })
})
