import { describe, expect, it } from 'vitest'
import {
  authorizationCoverageTarget,
  buildAuthorizationOverview,
  normalizeAuthorizationTab,
  permissionCoverage,
  permissionSelectionChanged,
  togglePermissionGroup,
} from './authorization-view'

const roles = [
  { id: 'role-1', isActive: true, isSystem: false, tenantId: 'tenant-1' },
  { id: 'role-2', isActive: true, isSystem: true, tenantId: null },
  { id: 'role-3', isActive: false, isSystem: false, tenantId: 'tenant-1' },
]

const permissions = [
  { id: 'p1', category: 'Medewerkers' },
  { id: 'p2', category: 'Medewerkers' },
  { id: 'p3', category: 'Salaris' },
]

describe('authorization overview', () => {
  it('berekent unieke toekenningen en beheerbare actieve tenantrollen', () => {
    const overview = buildAuthorizationOverview({
      roles,
      permissions,
      rolePermissions: [
        { roleId: 'role-1', permissionId: 'p1' },
        { roleId: 'role-1', permissionId: 'p2' },
        { roleId: 'role-2', permissionId: 'p1' },
        { roleId: 'role-2', permissionId: 'p1' },
      ],
    })

    expect(overview.roleCount).toBe(3)
    expect(overview.activeTenantRoleCount).toBe(1)
    expect(overview.assignedPermissionCount).toBe(3)
    expect(overview.categoryCount).toBe(2)
    expect(overview.categories.map((category) => category.name)).toEqual(['Medewerkers', 'Salaris'])
  })

  it('berekent dekkingspercentages ook voor een lege groep veilig', () => {
    expect(permissionCoverage(new Set(['p1']), ['p1', 'p2'])).toEqual({ assigned: 1, total: 2, percentage: 50 })
    expect(permissionCoverage(new Set(), [])).toEqual({ assigned: 0, total: 0, percentage: 0 })
  })

  it('schakelt een hele groep in en daarna weer uit zonder de invoerset te muteren', () => {
    const initial = new Set(['outside'])
    const selected = togglePermissionGroup(initial, ['p1', 'p2'])
    const cleared = togglePermissionGroup(selected, ['p1', 'p2'])

    expect(initial).toEqual(new Set(['outside']))
    expect(selected).toEqual(new Set(['outside', 'p1', 'p2']))
    expect(cleared).toEqual(new Set(['outside']))
  })

  it('normaliseert URL-tabs en vergelijkt selecties onafhankelijk van volgorde', () => {
    expect(normalizeAuthorizationTab('overview')).toBe('overview')
    expect(normalizeAuthorizationTab('unknown')).toBe('permissions')
    expect(normalizeAuthorizationTab(null)).toBe('permissions')
    expect(permissionSelectionChanged(new Set(['a']), new Set(['a', 'b']))).toBe(true)
    expect(permissionSelectionChanged(new Set(['b', 'a']), new Set(['a', 'b']))).toBe(false)
  })

  it('vertaalt een heatmapcel naar een expliciet rol- en categoriedoel', () => {
    expect(authorizationCoverageTarget(' role-1 ', ' Salaris ')).toEqual({ roleId: 'role-1', category: 'Salaris' })
  })
})
