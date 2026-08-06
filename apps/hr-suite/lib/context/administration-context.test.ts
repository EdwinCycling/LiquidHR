import { describe, expect, it } from 'vitest'
import {
  buildTenantContextOptions,
  ContextAccessError,
  getAdministrationSwitcherMode,
  getHrGroupSwitcherMode,
  selectActiveContext,
  type TenantContextOption,
} from './administration-context'

const tenantOne: TenantContextOption = {
  id: 'tenant-1',
  name: 'Liquid HR Demo Holding',
  slug: 'liquid-hr-demo-holding',
  administrationMode: 'SEPARATE',
  sharingMode: 'FULLY_ISOLATED',
  hrGroups: [
    {
      id: 'group-a',
      tenantId: 'tenant-1',
      code: 'A',
      name: 'HR-groep A',
      description: null,
      administrations: [{ id: 'admin-a1', code: 'A1', name: 'Administratie A1' }],
    },
    {
      id: 'group-b',
      tenantId: 'tenant-1',
      code: 'B',
      name: 'HR-groep B',
      description: null,
      administrations: [{ id: 'admin-b1', code: 'B1', name: 'Administratie B1' }],
    },
  ],
}

describe('selectActiveContext', () => {
  it('kiest de eerste toegestane groep en administratie als veilige default', () => {
    const result = selectActiveContext({ tenants: [tenantOne] })

    expect(result.tenant.id).toBe('tenant-1')
    expect(result.activeHrGroup.id).toBe('group-a')
    expect(result.activeAdministration?.id).toBe('admin-a1')
    expect(result.administrationsInActiveHrGroup).toHaveLength(1)
  })

  it('behoudt een expliciet toegestane groep en administratie', () => {
    const result = selectActiveContext({
      tenants: [tenantOne],
      requestedHrGroupId: 'group-b',
      requestedAdministrationId: 'admin-b1',
    })

    expect(result.activeHrGroup.id).toBe('group-b')
    expect(result.activeAdministration?.id).toBe('admin-b1')
  })

  it('valt bij gemanipuleerde cookies terug op toegestane context', () => {
    const result = selectActiveContext({
      tenants: [tenantOne],
      requestedHrGroupId: 'group-van-een-andere-klant',
      requestedAdministrationId: 'admin-van-een-andere-klant',
    })

    expect(result.activeHrGroup.id).toBe('group-a')
    expect(result.activeAdministration?.id).toBe('admin-a1')
  })

  it('laat een administratie uit groep B niet actief worden in groep A', () => {
    const result = selectActiveContext({
      tenants: [tenantOne],
      requestedHrGroupId: 'group-a',
      requestedAdministrationId: 'admin-b1',
    })

    expect(result.activeHrGroup.id).toBe('group-a')
    expect(result.activeAdministration?.id).toBe('admin-a1')
  })

  it('houdt administratie optioneel wanneer de groep nog geen administratie heeft', () => {
    const result = selectActiveContext({
      tenants: [{ ...tenantOne, hrGroups: [{ ...tenantOne.hrGroups[0], administrations: [] }] }],
    })

    expect(result.activeAdministration).toBeNull()
    expect(result.administrationsInActiveHrGroup).toHaveLength(0)
  })

  it('weigert een account zonder actieve HR-groep', () => {
    expect(() => selectActiveContext({ tenants: [{ ...tenantOne, hrGroups: [] }] })).toThrow(ContextAccessError)
  })
})

describe('buildTenantContextOptions', () => {
  const tenants = [{
    id: 'tenant-1',
    name: 'Holding',
    slug: 'holding',
    administration_mode: 'SEPARATE' as const,
    sharing_mode: 'FULLY_ISOLATED' as const,
  }]
  const hrGroups = [
    { id: 'group-a', tenant_id: 'tenant-1', code: 'A', name: 'Groep A', description: null, is_active: true },
    { id: 'group-b', tenant_id: 'tenant-1', code: 'B', name: 'Groep B', description: null, is_active: true },
  ]
  const administrations = [
    { id: 'admin-a1', tenant_id: 'tenant-1', hr_group_id: 'group-a', code: 'A1', name: 'A1', is_active: true },
    { id: 'admin-b1', tenant_id: 'tenant-1', hr_group_id: 'group-b', code: 'B1', name: 'B1', is_active: true },
  ]

  it('geeft tenantbrede toegang alle administraties, maar per groep', () => {
    const result = buildTenantContextOptions({
      groupAccesses: [
        { tenant_id: 'tenant-1', hr_group_id: 'group-a', management_role_code: 'TENANT_ADMIN' },
        { tenant_id: 'tenant-1', hr_group_id: 'group-b', management_role_code: 'TENANT_ADMIN' },
      ],
      administrationAccesses: [{ tenant_id: 'tenant-1', scope_type: 'TENANT', administration_id: null, hr_group_id: null }],
      tenants,
      hrGroups,
      administrations,
    })

    expect(result[0]?.hrGroups.map((group) => group.administrations.map((administration) => administration.id))).toEqual([
      ['admin-a1'],
      ['admin-b1'],
    ])
  })

  it('geeft een administratie-scope geen toegang tot de andere groep', () => {
    const result = buildTenantContextOptions({
      groupAccesses: [{ tenant_id: 'tenant-1', hr_group_id: 'group-b', management_role_code: 'TENANT_ADMIN' }],
      administrationAccesses: [{ tenant_id: 'tenant-1', scope_type: 'ADMINISTRATION', administration_id: 'admin-b1', hr_group_id: 'group-b' }],
      tenants,
      hrGroups,
      administrations,
    })

    expect(result[0]?.hrGroups).toHaveLength(1)
    expect(result[0]?.hrGroups[0]?.administrations.map((administration) => administration.id)).toEqual(['admin-b1'])
  })

  it('beperkt medewerker of manager tot de eigen administratie binnen de groep', () => {
    const result = buildTenantContextOptions({
      groupAccesses: [{ tenant_id: 'tenant-1', hr_group_id: 'group-a', management_role_code: 'EMPLOYEE' }],
      administrationAccesses: [{ tenant_id: 'tenant-1', scope_type: 'TENANT', administration_id: null, hr_group_id: null }],
      actorAdministrationIdsByHrGroup: new Map([['group-a', new Set(['admin-a1'])]]),
      tenants,
      hrGroups,
      administrations,
    })

    expect(result[0]?.hrGroups[0]?.administrations.map((administration) => administration.id)).toEqual(['admin-a1'])
  })
})

describe('switcher modes', () => {
  it('toont eerst de HR-groepkiezer en daarna administratie wanneer nodig', () => {
    const context = selectActiveContext({ tenants: [tenantOne] })
    expect(getHrGroupSwitcherMode(context)).toBe('SELECT')
    expect(getAdministrationSwitcherMode(context)).toBe('HIDDEN')
  })

  it('verbergt beide keuzelijsten bij één groep en één administratie', () => {
    const context = selectActiveContext({ tenants: [{ ...tenantOne, hrGroups: [tenantOne.hrGroups[0]] }] })
    expect(getHrGroupSwitcherMode(context)).toBe('HIDDEN')
    expect(getAdministrationSwitcherMode(context)).toBe('HIDDEN')
  })
})
