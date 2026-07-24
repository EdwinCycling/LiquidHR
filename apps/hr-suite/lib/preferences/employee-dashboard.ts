import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { employeeDashboardLayoutJson, parseEmployeeDashboardLayout, type EmployeeDashboardLayout } from './employee-dashboard-layout'
import { DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT } from './employee-dashboard-layout'
export { DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT, employeeDashboardLayoutJson, parseEmployeeDashboardLayout }
export type { EmployeeDashboardLayout }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

export async function getEmployeeDashboardLayout(): Promise<EmployeeDashboardLayout> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const state = isRecord(data?.ui_state) ? data.ui_state : {}
  return parseEmployeeDashboardLayout(state.employeeDashboard)
}

export async function saveEmployeeDashboardLayout(layout: EmployeeDashboardLayout): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return false
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const state = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    ui_state: { ...state, employeeDashboard: employeeDashboardLayoutJson(parseEmployeeDashboardLayout(layout)) },
  }, { onConflict: 'auth_user_id' })
  return !error
}
