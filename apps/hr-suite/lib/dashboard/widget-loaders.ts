import type { AuthContext } from '@/lib/auth/permissions'
import type { createClient } from '@/lib/supabase/server'
import type { DashboardWidget } from './service'

type DashboardSupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface DashboardLoaderScope {
  context: AuthContext
  supabase: DashboardSupabaseClient | null
}

export type DashboardWidgetData =
  | { status: 'ready'; kind: 'welcome' }
  | { status: 'ready'; kind: 'metric'; value: number; href: string }
  | { status: 'empty'; reason: 'NO_DATA' | 'DATA_SOURCE_PENDING' }
  | { status: 'error'; code: 'WIDGET_LOAD_FAILED' }

async function countScopedEmployees(scope: DashboardLoaderScope): Promise<number> {
  if (!scope.supabase) return 0
  if (!scope.context.administrationId) {
    const result = await scope.supabase.from('employees').select('id', { count: 'exact', head: true })
      .eq('tenant_id', scope.context.tenantId).eq('is_active', true).is('deleted_at', null)
    if (result.error) throw result.error
    return result.count ?? 0
  }

  const today = new Date().toISOString().slice(0, 10)
  const assignments = await scope.supabase.from('employee_administration_assignments').select('employee_id')
    .eq('tenant_id', scope.context.tenantId).eq('administration_id', scope.context.administrationId)
    .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(10000)
  if (assignments.error) throw assignments.error
  const employeeIds = [...new Set(assignments.data.map((assignment) => assignment.employee_id))]
  if (employeeIds.length === 0) return 0

  const result = await scope.supabase.from('employees').select('id', { count: 'exact', head: true })
    .in('id', employeeIds).eq('tenant_id', scope.context.tenantId).eq('is_active', true).is('deleted_at', null)
  if (result.error) throw result.error
  return result.count ?? 0
}

export async function loadDashboardWidgetData(
  scope: DashboardLoaderScope,
  widget: DashboardWidget,
): Promise<DashboardWidgetData> {
  if (widget.type === 'WELCOME') return { status: 'ready', kind: 'welcome' }
  if (!['MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW', 'COMPANY_DOCUMENTS'].includes(widget.type)) {
    return { status: 'empty', reason: 'DATA_SOURCE_PENDING' }
  }
  if (!scope.supabase) return { status: 'error', code: 'WIDGET_LOAD_FAILED' }

  try {
    if (widget.type === 'MY_REMINDERS') {
      let query = scope.supabase.from('reminder_recipients').select('id, reminders!inner(administration_id)', { count: 'exact', head: true })
        .eq('tenant_id', scope.context.tenantId).eq('user_id', scope.context.userId).eq('status', 'PENDING')
      query = scope.context.administrationId
        ? query.eq('reminders.administration_id', scope.context.administrationId)
        : query.is('reminders.administration_id', null)
      const result = await query
      if (result.error) throw result.error
      return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/reminders' }
    }
    if (widget.type === 'ORGANIZATION_OVERVIEW') {
      const query = scope.supabase.from('departments').select('id', { count: 'exact', head: true })
        .eq('tenant_id', scope.context.tenantId).eq('is_active', true)
      const result = await query
      if (result.error) throw result.error
      return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/organization' }
    }
    if (widget.type === 'COMPANY_DOCUMENTS') {
      let query = scope.supabase.from('company_documents').select('id', { count: 'exact', head: true }).eq('tenant_id', scope.context.tenantId).is('deleted_at', null)
      if (scope.context.administrationId) query = query.eq('administration_id', scope.context.administrationId)
      const result = await query
      if (result.error) throw result.error
      return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/company-documents' }
    }
    return { status: 'ready', kind: 'metric', value: await countScopedEmployees(scope), href: '/employees' }
  } catch {
    return { status: 'error', code: 'WIDGET_LOAD_FAILED' }
  }
}
