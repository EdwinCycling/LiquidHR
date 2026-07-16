export type AdministrationMode = 'SEPARATE' | 'COMBINED'
export type SharingMode = 'FULLY_ISOLATED' | 'SHARED_COLLEAGUES'

export interface AdministrationContextOption {
  id: string
  code: string
  name: string
}

export interface TenantContextOption {
  id: string
  name: string
  slug: string
  administrationMode: AdministrationMode
  sharingMode: SharingMode
  administrations: AdministrationContextOption[]
}

export interface ActiveContext {
  tenant: Omit<TenantContextOption, 'administrations'>
  administration: AdministrationContextOption | null
  administrations: AdministrationContextOption[]
}

export interface SelectActiveContextInput {
  tenants: TenantContextOption[]
  requestedTenantId?: string
  requestedAdministrationId?: string
}

export interface ContextAccessRow {
  tenant_id: string
  scope_type: 'TENANT' | 'ADMINISTRATION'
  administration_id: string | null
}

export interface ContextTenantRow {
  id: string
  name: string
  slug: string
  administration_mode: AdministrationMode
  sharing_mode: SharingMode
}

export interface ContextAdministrationRow {
  id: string
  tenant_id: string
  code: string
  name: string
  is_active: boolean
}

export interface BuildTenantContextOptionsInput {
  accesses: ContextAccessRow[]
  tenants: ContextTenantRow[]
  administrations: ContextAdministrationRow[]
}

export class ContextAccessError extends Error {
  readonly status = 403
}

export type AdministrationSwitcherMode = 'HIDDEN' | 'LABEL' | 'SELECT'

export function getAdministrationSwitcherMode(context: ActiveContext): AdministrationSwitcherMode {
  if (context.tenant.administrationMode === 'COMBINED') return 'HIDDEN'
  return context.administrations.length > 1 ? 'SELECT' : 'LABEL'
}

export function buildTenantContextOptions(input: BuildTenantContextOptionsInput): TenantContextOption[] {
  const tenantIds = new Set(input.accesses.map((access) => access.tenant_id))

  return input.tenants
    .filter((tenant) => tenantIds.has(tenant.id))
    .map((tenant) => {
      const tenantAccesses = input.accesses.filter((access) => access.tenant_id === tenant.id)
      const hasTenantScope = tenantAccesses.some((access) => access.scope_type === 'TENANT')
      const administrationIds = new Set(
        tenantAccesses
          .filter((access) => access.scope_type === 'ADMINISTRATION')
          .map((access) => access.administration_id)
          .filter((administrationId): administrationId is string => administrationId !== null),
      )
      const administrations = input.administrations
        .filter(
          (administration) =>
            administration.tenant_id === tenant.id
            && administration.is_active
            && (hasTenantScope || administrationIds.has(administration.id)),
        )
        .map(({ id, code, name }) => ({ id, code, name }))

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        administrationMode: tenant.administration_mode,
        sharingMode: tenant.sharing_mode,
        administrations,
      }
    })
}

export function selectActiveContext(input: SelectActiveContextInput): ActiveContext {
  const tenant =
    input.tenants.find((option) => option.id === input.requestedTenantId) ?? input.tenants[0]

  if (!tenant) throw new ContextAccessError('Je hebt geen toegang tot een actieve klantomgeving.')

  const { administrations, ...tenantContext } = tenant
  if (tenant.administrationMode === 'COMBINED') {
    return { tenant: tenantContext, administration: null, administrations }
  }

  const administration =
    administrations.find((option) => option.id === input.requestedAdministrationId) ?? administrations[0]

  if (!administration) {
    throw new ContextAccessError('Je hebt geen toegang tot een actieve administratie.')
  }

  return { tenant: tenantContext, administration, administrations }
}
