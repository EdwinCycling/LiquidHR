import type { AuthContext } from '@/lib/auth/permissions'
import { requireAuthContext } from '@/lib/auth/permissions'
import { selectActiveContext, type TenantContextOption } from '@/lib/context/administration-context'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type DirectManagerContextResolution =
  | { readonly kind: 'resolved'; readonly context: AuthContext }
  | { readonly kind: 'none' }
  | { readonly kind: 'selection-required' }
  | { readonly kind: 'unavailable' }

interface CurrentEmployment {
  readonly administration_id: string
  readonly starts_on: string
  readonly ends_on: string | null
}

const MAX_MANAGER_CONTEXT_GROUPS = 50
const MAX_MANAGER_CONTEXT_ADMINISTRATIONS = 100

function isCurrentEmployment(row: CurrentEmployment, today: string): boolean {
  return row.starts_on <= today && (row.ends_on === null || row.ends_on >= today)
}

function findTenantGroup(
  tenants: readonly TenantContextOption[],
  tenantId: string,
  hrGroupId: string,
): TenantContextOption | null {
  const tenant = tenants.find((candidate) => candidate.id === tenantId)
  return tenant?.hrGroups.some((group) => group.id === hrGroupId) ? tenant : null
}

function isDirectManagerContext(
  context: AuthContext,
  userId: string,
  tenantId: string,
  hrGroupId: string,
  administrationId: string,
  employeeId: string,
): boolean {
  return context.userId === userId
    && context.tenantId === tenantId
    && context.hrGroupId === hrGroupId
    && context.administrationId === administrationId
    && context.employeeId === employeeId
    && context.activeRoles.includes('DIRECT_MANAGER')
    && context.focusExperience !== 'NO_EMPLOYMENT'
}

/**
 * Resolve one current Direct Manager context from the authenticated subject.
 * No request, cookie, tenant, HR-group, administration, employee, or role
 * selector participates in context selection.
 */
export async function resolveDirectManagerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<DirectManagerContextResolution> {
  try {
    const accessible = await loadAccessibleContextOptions(userId, supabase, { requireComplete: true })
    if (accessible.userId !== userId) return { kind: 'unavailable' }

    const groups = accessible.tenants.flatMap((tenant) => tenant.hrGroups.map((hrGroup) => ({ tenant, hrGroup })))
    if (groups.length > MAX_MANAGER_CONTEXT_GROUPS) return { kind: 'selection-required' }

    const candidates = new Map<string, AuthContext>()
    let scannedAdministrations = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const { tenant, hrGroup } of groups) {
      const administrations = hrGroup.administrations
      if (administrations.length === 0) continue
      scannedAdministrations += administrations.length
      if (scannedAdministrations > MAX_MANAGER_CONTEXT_ADMINISTRATIONS) return { kind: 'selection-required' }

      const firstAdministration = administrations[0]
      if (!firstAdministration) continue
      const firstActiveContext = selectActiveContext({
        tenants: [findTenantGroup(accessible.tenants, tenant.id, hrGroup.id) ?? tenant],
        requestedTenantId: tenant.id,
        requestedHrGroupId: hrGroup.id,
        requestedAdministrationId: firstAdministration.id,
      })
      const firstContext = await requireAuthContext(supabase, firstActiveContext)
      if (
        firstContext.userId !== userId
        || !firstContext.employeeId
        || firstContext.hrGroupId !== hrGroup.id
        || firstContext.tenantId !== tenant.id
        || !firstContext.activeRoles.includes('DIRECT_MANAGER')
      ) continue

      const administrationIds = administrations.map((administration) => administration.id)
      const { data: employments, error } = await supabase
        .from('employments')
        .select('administration_id,starts_on,ends_on')
        .eq('employee_id', firstContext.employeeId)
        .eq('tenant_id', tenant.id)
        .eq('hr_group_id', hrGroup.id)
        .in('administration_id', administrationIds)
        .eq('record_status', 'CONFIRMED')
        .lte('starts_on', today)
        .or(`ends_on.is.null,ends_on.gte.${today}`)
        .is('deleted_at', null)
        .limit(1_000)
      if (error || employments.length >= 1_000) return { kind: 'unavailable' }

      const assignedAdministrationIds = new Set(
        (employments as CurrentEmployment[])
          .filter((employment) => isCurrentEmployment(employment, today))
          .map((employment) => employment.administration_id),
      )
      for (const administration of administrations) {
        if (!assignedAdministrationIds.has(administration.id)) continue
        const activeContext = selectActiveContext({
          tenants: [findTenantGroup(accessible.tenants, tenant.id, hrGroup.id) ?? tenant],
          requestedTenantId: tenant.id,
          requestedHrGroupId: hrGroup.id,
          requestedAdministrationId: administration.id,
        })
        const context = administration.id === firstAdministration.id
          ? firstContext
          : await requireAuthContext(supabase, activeContext)
        if (isDirectManagerContext(context, userId, tenant.id, hrGroup.id, administration.id, firstContext.employeeId)) {
          candidates.set(`${tenant.id}\u0000${hrGroup.id}\u0000${administration.id}`, context)
        }
      }
    }

    if (candidates.size === 0) return { kind: 'none' }
    if (candidates.size > 1) return { kind: 'selection-required' }
    const context = candidates.values().next().value as AuthContext | undefined
    return context ? { kind: 'resolved', context } : { kind: 'unavailable' }
  } catch {
    return { kind: 'unavailable' }
  }
}
