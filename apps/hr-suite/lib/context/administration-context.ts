export type AdministrationMode = 'SEPARATE' | 'COMBINED'
export type SharingMode = 'FULLY_ISOLATED' | 'SHARED_COLLEAGUES'

export interface AdministrationContextOption {
  id: string
  code: string
  name: string
  administrationNumber?: string
  cocNumber?: string | null
  vatNumber?: string | null
  parentId?: string | null
  isActive?: boolean
}

export interface HrGroupContextOption {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  administrations: AdministrationContextOption[]
}

export interface TenantContextOption {
  id: string
  name: string
  slug: string
  administrationMode: AdministrationMode
  sharingMode: SharingMode
  hrGroups: HrGroupContextOption[]
}

export interface ActiveContext {
  tenant: Omit<TenantContextOption, 'hrGroups'>
  hrGroups: HrGroupContextOption[]
  activeHrGroup: HrGroupContextOption
  administrationsInActiveHrGroup: AdministrationContextOption[]
  activeAdministration: AdministrationContextOption | null
}

export interface SelectActiveContextInput {
  tenants: TenantContextOption[]
  requestedTenantId?: string
  requestedHrGroupId?: string
  requestedAdministrationId?: string
}

export interface ContextGroupAccessRow {
  tenant_id: string
  hr_group_id: string
  management_role_code: string
}

export interface ContextAdministrationAccessRow {
  tenant_id: string
  scope_type: 'TENANT' | 'ADMINISTRATION'
  administration_id: string | null
  hr_group_id: string | null
}

export interface ContextTenantRow {
  id: string
  name: string
  slug: string
  administration_mode: AdministrationMode
  sharing_mode: SharingMode
}

export interface ContextHrGroupRow {
  id: string
  tenant_id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export interface ContextAdministrationRow {
  id: string
  tenant_id: string
  hr_group_id: string
  code: string
  name: string
  administration_number?: string
  coc_number?: string | null
  vat_number?: string | null
  parent_id?: string | null
  is_active: boolean
}

export interface BuildTenantContextOptionsInput {
  groupAccesses: ContextGroupAccessRow[]
  administrationAccesses: ContextAdministrationAccessRow[]
  tenants: ContextTenantRow[]
  hrGroups: ContextHrGroupRow[]
  administrations: ContextAdministrationRow[]
  actorAdministrationIdsByHrGroup?: ReadonlyMap<string, ReadonlySet<string>>
}

export class ContextAccessError extends Error {
  readonly status = 403
}

export type HrGroupSwitcherMode = 'HIDDEN' | 'SELECT'
export type AdministrationSwitcherMode = 'HIDDEN' | 'SELECT'

const EMPLOYEE_MANAGER_ROLE_CODES = new Set(['EMPLOYEE', 'DIRECT_MANAGER'])

export const HR_GROUP_SWITCH_SUCCESS_PATH = '/dashboard/start'
export const ADMINISTRATION_SWITCH_SUCCESS_PATH = '/dashboard/start'

export function getHrGroupSwitcherMode(context: ActiveContext): HrGroupSwitcherMode {
  return context.hrGroups.length > 1 ? 'SELECT' : 'HIDDEN'
}

export function getAdministrationSwitcherMode(context: ActiveContext): AdministrationSwitcherMode {
  return context.administrationsInActiveHrGroup.length > 1 ? 'SELECT' : 'HIDDEN'
}

export function buildTenantContextOptions(input: BuildTenantContextOptionsInput): TenantContextOption[] {
  const tenantIds = new Set(input.groupAccesses.map((access) => access.tenant_id))

  return input.tenants
    .filter((tenant) => tenantIds.has(tenant.id))
    .map((tenant) => {
      const tenantGroupAccesses = input.groupAccesses.filter((access) => access.tenant_id === tenant.id)
      const tenantAdministrationAccesses = input.administrationAccesses.filter((access) => access.tenant_id === tenant.id)
      const tenantGroups = input.hrGroups
        .filter((group) => group.tenant_id === tenant.id && group.is_active)
        .map((group) => {
          const groupAccesses = tenantGroupAccesses.filter((access) => access.hr_group_id === group.id)
          const hasTenantScope = tenantAdministrationAccesses.some((access) => access.scope_type === 'TENANT')
          const explicitlyAllowedAdministrationIds = new Set(
            tenantAdministrationAccesses
              .filter((access) => access.scope_type === 'ADMINISTRATION' && access.hr_group_id === group.id)
              .map((access) => access.administration_id)
              .filter((administrationId): administrationId is string => administrationId !== null),
          )
          const isEmployeeManagerOnly = groupAccesses.length > 0
            && groupAccesses.every((access) => EMPLOYEE_MANAGER_ROLE_CODES.has(access.management_role_code))
          const actorAdministrationIds = isEmployeeManagerOnly
            ? input.actorAdministrationIdsByHrGroup?.get(group.id) ?? new Set<string>()
            : null
          const administrations = input.administrations
            .filter(
              (administration) =>
                administration.tenant_id === tenant.id
                && administration.hr_group_id === group.id
                && administration.is_active
                && (hasTenantScope || explicitlyAllowedAdministrationIds.has(administration.id))
                && (actorAdministrationIds === null || actorAdministrationIds.has(administration.id)),
            )
            .map(({ id, code, name, administration_number, coc_number, vat_number, parent_id, is_active }) => ({ id, code, name, administrationNumber: administration_number ?? code, cocNumber: coc_number, vatNumber: vat_number, parentId: parent_id, isActive: is_active }))

          return {
            id: group.id,
            tenantId: group.tenant_id,
            code: group.code,
            name: group.name,
            description: group.description,
            administrations,
          }
        })
        .filter((group) => groupAccessesForGroup(tenantGroupAccesses, group.id).length > 0)

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        administrationMode: tenant.administration_mode,
        sharingMode: tenant.sharing_mode,
        hrGroups: tenantGroups,
      }
    })
    .filter((tenant) => tenant.hrGroups.length > 0)
}

function groupAccessesForGroup(accesses: ContextGroupAccessRow[], groupId: string): ContextGroupAccessRow[] {
  return accesses.filter((access) => access.hr_group_id === groupId)
}

export function selectActiveContext(input: SelectActiveContextInput): ActiveContext {
  const tenant =
    input.tenants.find((option) => option.id === input.requestedTenantId) ?? input.tenants[0]

  if (!tenant) throw new ContextAccessError('Je hebt geen toegang tot een actieve klantomgeving.')

  const activeHrGroup =
    tenant.hrGroups.find((group) => group.id === input.requestedHrGroupId) ?? tenant.hrGroups[0]

  if (!activeHrGroup) throw new ContextAccessError('Je hebt geen toegang tot een actieve HR-groep.')

  const { hrGroups, ...tenantContext } = tenant
  const administrationsInActiveHrGroup = activeHrGroup.administrations
  const activeAdministration =
    administrationsInActiveHrGroup.find((option) => option.id === input.requestedAdministrationId)
    ?? administrationsInActiveHrGroup[0]
    ?? null

  return {
    tenant: tenantContext,
    hrGroups,
    activeHrGroup,
    administrationsInActiveHrGroup,
    activeAdministration,
  }
}
