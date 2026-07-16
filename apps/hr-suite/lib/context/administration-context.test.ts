import { describe, expect, it } from 'vitest'
import {
  buildTenantContextOptions,
  ContextAccessError,
  getAdministrationSwitcherMode,
  selectActiveContext,
  type TenantContextOption,
} from './administration-context'

const tenantOne: TenantContextOption = {
  id: 'tenant-1',
  name: 'Liquid HR Demo Holding',
  slug: 'liquid-hr-demo-holding',
  administrationMode: 'SEPARATE',
  sharingMode: 'FULLY_ISOLATED',
  administrations: [
    { id: 'admin-holding', code: 'HOLDING', name: 'Liquid HR Demo Holding B.V.' },
    { id: 'admin-services', code: 'SERVICES', name: 'Liquid HR Services B.V.' },
  ],
}

const tenantTwo: TenantContextOption = {
  id: 'tenant-2',
  name: 'Noorderlicht Zorggroep',
  slug: 'noorderlicht-zorggroep',
  administrationMode: 'SEPARATE',
  sharingMode: 'FULLY_ISOLATED',
  administrations: [{ id: 'admin-care', code: 'CARE', name: 'Noorderlicht Zorg B.V.' }],
}

describe('selectActiveContext', () => {
  it('kiest de eerste toegestane tenant en administratie als veilige default', () => {
    const result = selectActiveContext({ tenants: [tenantOne, tenantTwo] })

    expect(result.tenant.id).toBe('tenant-1')
    expect(result.administration?.id).toBe('admin-holding')
  })

  it('behoudt een expliciet toegestane administratie', () => {
    const result = selectActiveContext({
      tenants: [tenantOne],
      requestedTenantId: 'tenant-1',
      requestedAdministrationId: 'admin-services',
    })

    expect(result.administration?.id).toBe('admin-services')
  })

  it('valt bij een gemanipuleerde tenantcookie terug op een toegestane tenant', () => {
    const result = selectActiveContext({
      tenants: [tenantOne],
      requestedTenantId: 'tenant-van-een-andere-klant',
      requestedAdministrationId: 'admin-van-een-andere-klant',
    })

    expect(result.tenant.id).toBe('tenant-1')
    expect(result.administration?.id).toBe('admin-holding')
  })

  it('kan geen siblingadministratie selecteren die niet in de toegestane opties staat', () => {
    const restrictedTenant: TenantContextOption = {
      ...tenantOne,
      administrations: [tenantOne.administrations[0]],
    }

    const result = selectActiveContext({
      tenants: [restrictedTenant],
      requestedAdministrationId: 'admin-services',
    })

    expect(result.administration?.id).toBe('admin-holding')
  })

  it('retourneert geen actieve administratie in gecombineerde modus', () => {
    const result = selectActiveContext({
      tenants: [{ ...tenantOne, administrationMode: 'COMBINED' }],
      requestedAdministrationId: 'admin-services',
    })

    expect(result.administration).toBeNull()
    expect(result.administrations).toHaveLength(2)
  })

  it('weigert een account zonder actieve tenanttoegang', () => {
    expect(() => selectActiveContext({ tenants: [] })).toThrow(ContextAccessError)
  })

  it('weigert gescheiden gebruik zonder toegestane administratie', () => {
    expect(() => selectActiveContext({ tenants: [{ ...tenantOne, administrations: [] }] })).toThrow(
      'Je hebt geen toegang tot een actieve administratie.',
    )
  })
})

describe('buildTenantContextOptions', () => {
  const tenants = [
    {
      id: 'tenant-1',
      name: 'Liquid HR Demo Holding',
      slug: 'liquid-hr-demo-holding',
      administration_mode: 'SEPARATE' as const,
      sharing_mode: 'FULLY_ISOLATED' as const,
    },
    {
      id: 'tenant-2',
      name: 'Noorderlicht Zorggroep',
      slug: 'noorderlicht-zorggroep',
      administration_mode: 'SEPARATE' as const,
      sharing_mode: 'FULLY_ISOLATED' as const,
    },
  ]
  const administrations = [
    { id: 'admin-holding', tenant_id: 'tenant-1', code: 'HOLDING', name: 'Holding', is_active: true },
    { id: 'admin-services', tenant_id: 'tenant-1', code: 'SERVICES', name: 'Services', is_active: true },
    { id: 'admin-care', tenant_id: 'tenant-2', code: 'CARE', name: 'Zorg', is_active: true },
  ]

  it('geeft tenantbrede toegang uitsluitend administraties van die tenant', () => {
    const result = buildTenantContextOptions({
      accesses: [{ tenant_id: 'tenant-1', scope_type: 'TENANT', administration_id: null }],
      tenants,
      administrations,
    })

    expect(result).toHaveLength(1)
    expect(result[0].administrations.map((administration) => administration.id)).toEqual([
      'admin-holding',
      'admin-services',
    ])
  })

  it('geeft administratiescope niet stil toegang tot een sibling', () => {
    const result = buildTenantContextOptions({
      accesses: [
        { tenant_id: 'tenant-1', scope_type: 'ADMINISTRATION', administration_id: 'admin-services' },
      ],
      tenants,
      administrations,
    })

    expect(result[0].administrations.map((administration) => administration.id)).toEqual(['admin-services'])
  })
})

describe('getAdministrationSwitcherMode', () => {
  it('toont een dropdown bij meerdere administraties in gescheiden modus', () => {
    expect(getAdministrationSwitcherMode(selectActiveContext({ tenants: [tenantOne] }))).toBe('SELECT')
  })

  it('toont alleen een label bij één administratie', () => {
    const context = selectActiveContext({
      tenants: [{ ...tenantOne, administrations: [tenantOne.administrations[0]] }],
    })

    expect(getAdministrationSwitcherMode(context)).toBe('LABEL')
  })

  it('verbergt de algemene kiezer in gecombineerde modus', () => {
    const context = selectActiveContext({
      tenants: [{ ...tenantOne, administrationMode: 'COMBINED' }],
    })

    expect(getAdministrationSwitcherMode(context)).toBe('HIDDEN')
  })
})
