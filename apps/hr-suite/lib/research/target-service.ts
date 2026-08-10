import type { AuthContext } from '@/lib/auth/permissions'
import { requireHrGroupId } from '@/lib/auth/permissions'
import type { createClient } from '@/lib/supabase/server'
import type { ResearchTargetMode } from './schemas'
import { ResearchError } from './errors'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface ResearchTargetOptions {
  departments: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string }>
  entities: Array<{ id: string; name: string }>
  employees: Array<{ id: string; label: string; employeeNumber: string }>
}

export async function listResearchTargetOptions(context: AuthContext, supabase: ServerClient): Promise<ResearchTargetOptions> {
  const hrGroupId = requireHrGroupId(context)
  const [departments, locations, entities, employees] = await Promise.all([
    supabase.from('departments').select('id, name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    supabase.from('administration_locations').select('id, name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    supabase.from('administrations').select('id, name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    supabase.from('employees').select('id, first_name, birth_name_prefix, birth_name, employee_number').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).not('auth_user_id', 'is', null).order('birth_name').limit(5000),
  ])
  if (departments.error || locations.error || entities.error || employees.error) throw new ResearchError('RESEARCH_TARGETS_READ_FAILED', 500)

  return {
    departments: departments.data ?? [],
    locations: locations.data ?? [],
    entities: entities.data ?? [],
    employees: (employees.data ?? []).map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employee_number,
      label: [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' '),
    })),
  }
}

export async function resolveTargetEmployeeIds(
  context: AuthContext,
  supabase: ServerClient,
  mode: ResearchTargetMode,
  ids: readonly string[],
): Promise<string[]> {
  const hrGroupId = requireHrGroupId(context)
  let candidateIds: string[] | null = null
  if (mode === 'EMPLOYEES') candidateIds = [...ids]
  if (mode === 'DEPARTMENTS' || mode === 'LOCATIONS' || mode === 'ENTITIES') {
    const today = new Date().toISOString().slice(0, 10)
    let query = supabase.from('employee_organizations').select('employee_id')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(10000)
    query = mode === 'DEPARTMENTS' ? query.in('department_id', ids) : mode === 'LOCATIONS' ? query.in('location_id', ids) : query.in('administration_id', ids)
    const organizations = await query
    if (organizations.error) throw new ResearchError('RESEARCH_TARGETS_RESOLVE_FAILED', 500)
    candidateIds = [...new Set((organizations.data ?? []).map((organization) => organization.employee_id))]
  }

  let employeesQuery = supabase.from('employees').select('id')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
    .eq('is_active', true).eq('is_archived', false).is('deleted_at', null).not('auth_user_id', 'is', null).limit(10000)
  if (candidateIds !== null) {
    if (candidateIds.length === 0) return []
    employeesQuery = employeesQuery.in('id', candidateIds)
  }
  const employees = await employeesQuery
  if (employees.error) throw new ResearchError('RESEARCH_TARGETS_RESOLVE_FAILED', 500)
  return [...new Set((employees.data ?? []).map((employee) => employee.id))]
}
