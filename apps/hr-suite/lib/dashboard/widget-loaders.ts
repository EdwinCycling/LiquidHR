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

export async function loadDashboardWidgetData(
  scope: DashboardLoaderScope,
  widget: DashboardWidget,
): Promise<DashboardWidgetData> {
  if (widget.type === 'WELCOME') return { status: 'ready', kind: 'welcome' }
  if (!['MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW'].includes(widget.type)) {
    return { status: 'empty', reason: 'DATA_SOURCE_PENDING' }
  }
  if (!scope.supabase) return { status: 'error', code: 'WIDGET_LOAD_FAILED' }

  try {
    if (widget.type === 'MY_REMINDERS') {
      const result = await scope.supabase.from('reminder_recipients').select('id', { count: 'exact', head: true })
        .eq('tenant_id', scope.context.tenantId).eq('status', 'PENDING')
      if (result.error) throw result.error
      return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/reminders' }
    }
    if (widget.type === 'ORGANIZATION_OVERVIEW') {
      const result = await scope.supabase.from('departments').select('id', { count: 'exact', head: true })
        .eq('tenant_id', scope.context.tenantId).eq('is_active', true)
      if (result.error) throw result.error
      return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/organization' }
    }
    const result = await scope.supabase.from('employees').select('id', { count: 'exact', head: true })
      .eq('tenant_id', scope.context.tenantId).eq('is_active', true).is('deleted_at', null)
    if (result.error) throw result.error
    return { status: 'ready', kind: 'metric', value: result.count ?? 0, href: '/employees' }
  } catch {
    return { status: 'error', code: 'WIDGET_LOAD_FAILED' }
  }
}
