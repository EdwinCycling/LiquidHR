import { describe, expect, it } from 'vitest'
import { HR_GROUP_TIME_ZONES, hrGroupTimeZoneLabel, isHrGroupTimeZone } from './hr-group-timezones'

describe('HR-group timezone choices', () => {
  it('uses supported IANA zones and shows a recognizable city label', () => {
    expect(HR_GROUP_TIME_ZONES).toContain('Europe/Amsterdam')
    expect(HR_GROUP_TIME_ZONES).toContain('Asia/Hong_Kong')
    expect(hrGroupTimeZoneLabel('Europe/Amsterdam')).toBe('Amsterdam')
    expect(hrGroupTimeZoneLabel('Asia/Hong_Kong')).toBe('Hong Kong')
    expect(isHrGroupTimeZone('UTC')).toBe(true)
    expect(isHrGroupTimeZone('not/a-time-zone')).toBe(false)
  })
})
