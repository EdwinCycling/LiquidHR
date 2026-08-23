import { describe, expect, it } from 'vitest'
import { normalizeStorageObjectPath, resolveStoredImageUrl } from './image-url'

describe('resolveStoredImageUrl', () => {
  it('normaliseert zowel objectpaden als legacy storage-referenties voor server-side signing', () => {
    expect(normalizeStorageObjectPath('tenant-1/hr-group-1/logo.jpg')).toBe('tenant-1/hr-group-1/logo.jpg')
    expect(normalizeStorageObjectPath(' storage://tenant-1/hr-group-1/logo.jpg ')).toBe('tenant-1/hr-group-1/logo.jpg')
    expect(normalizeStorageObjectPath('storage://')).toBeNull()
  })

  it('vertaalt een interne avatarreferentie naar de bestaande geauthenticeerde proxy', () => {
    expect(resolveStoredImageUrl('storage://tenant-1/employee-1/avatar.jpg', {
      kind: 'employee-avatar',
      employeeId: 'employee-1',
    })).toBe('/api/employees/employee-1/avatar')
  })

  it('vertaalt een interne brandingreferentie naar de bestaande geauthenticeerde proxy', () => {
    expect(resolveStoredImageUrl('storage://tenant-1/hr-group-1/logo.jpg', { kind: 'company-branding' }))
      .toBe('/api/settings/company-branding/logo')
    expect(resolveStoredImageUrl('tenant-1/hr-group-1/logo.jpg', { kind: 'company-branding' }))
      .toBe('/api/settings/company-branding/logo')
  })

  it('behoudt ondersteunde web- en data-image-URLs', () => {
    expect(resolveStoredImageUrl('https://cdn.example.test/avatar.jpg', {
      kind: 'employee-avatar',
      employeeId: 'employee-1',
    })).toBe('https://cdn.example.test/avatar.jpg')
    expect(resolveStoredImageUrl('data:image/svg+xml;base64,fixture', {
      kind: 'employee-avatar',
      employeeId: 'employee-1',
    })).toBe('data:image/svg+xml;base64,fixture')
  })

  it('geeft bij null, lege of ongeldige fotoverwijzingen de fallback terug', () => {
    expect(resolveStoredImageUrl(null, { kind: 'employee-avatar', employeeId: 'employee-1' })).toBeNull()
    expect(resolveStoredImageUrl('   ', { kind: 'employee-avatar', employeeId: 'employee-1' })).toBeNull()
    expect(resolveStoredImageUrl('javascript:alert(1)', { kind: 'employee-avatar', employeeId: 'employee-1' })).toBeNull()
    expect(resolveStoredImageUrl('storage://', { kind: 'employee-avatar', employeeId: 'employee-1' })).toBeNull()
    expect(resolveStoredImageUrl('javascript:alert(1)', { kind: 'company-branding' })).toBeNull()
  })
})
