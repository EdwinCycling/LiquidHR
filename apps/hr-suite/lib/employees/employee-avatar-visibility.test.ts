import { describe, expect, it } from 'vitest'
import { getEmployeeListAvatarUrl } from './employee-avatar-visibility'

describe('getEmployeeListAvatarUrl', () => {
  it('hides a protected peer avatar from directory mode', () => {
    expect(getEmployeeListAvatarUrl({ id: 'peer-1', avatarUrl: '/api/employees/peer-1/avatar' }, true, 'employee-1')).toBeNull()
  })

  it('keeps data avatars available to directory mode', () => {
    const dataAvatar = 'data:image/svg+xml;base64,fixture'
    expect(getEmployeeListAvatarUrl({ id: 'peer-1', avatarUrl: dataAvatar }, true, 'employee-1')).toBe(dataAvatar)
  })

  it('keeps the current employee avatar available to the employee', () => {
    expect(getEmployeeListAvatarUrl({ id: 'employee-1', avatarUrl: '/api/employees/employee-1/avatar' }, true, 'employee-1')).toBe('/api/employees/employee-1/avatar')
  })
})
