import { describe, expect, it } from 'vitest'
import { LEAVE_SETTINGS_SECTION_ORDER, resolveLeaveSettingsSection } from './leave-settings-workspace'

describe('leave settings workspace navigation', () => {
  it('starts with profiles while keeping explicit deep links intact', () => {
    expect(LEAVE_SETTINGS_SECTION_ORDER).toEqual(['profiles', 'types', 'sets', 'yearEnd'])
    expect(resolveLeaveSettingsSection(null)).toBe('profiles')
    expect(resolveLeaveSettingsSection('types')).toBe('types')
    expect(resolveLeaveSettingsSection('yearEnd')).toBe('yearEnd')
  })
})
