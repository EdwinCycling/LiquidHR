import 'server-only'

import type { Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import type { OrganizationChartExplorerQuery } from '@/components/organization-chart/organization-chart-explorer'

const FILTER_KEYS = ['view', 'date', 'q', 'department', 'role', 'field', 'value'] as const

function isOrganizationChartView(value: string): value is OrganizationChartExplorerQuery['view'] {
  return value === 'department' || value === 'manager' || value === 'job'
}

function isRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function getStoredOrganizationChartFilter(): Promise<Partial<OrganizationChartExplorerQuery>> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return {}
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  if (!isRecord(data?.ui_state) || !isRecord(data.ui_state.organizationChart)) return {}
  const state = data.ui_state.organizationChart
  const result: Partial<OrganizationChartExplorerQuery> = {}
  for (const key of FILTER_KEYS) {
    const value = state[key]
    if (typeof value !== 'string' || value.length === 0) continue
    if (key === 'view') {
      if (isOrganizationChartView(value)) result.view = value
      continue
    }
    result[key] = value
  }
  return result
}

export async function saveOrganizationChartFilter(filter: Partial<OrganizationChartExplorerQuery>): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return false
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const currentState = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const currentChart = isRecord(currentState.organizationChart) ? currentState.organizationChart : {}
  const nextChart: { [key: string]: Json | undefined } = { ...currentChart }
  for (const key of FILTER_KEYS) {
    const value = filter[key]
    if (typeof value === 'string' && value.length > 0) nextChart[key] = value
    else delete nextChart[key]
  }
  const { error } = await supabase.from('user_preferences').upsert({ auth_user_id: userId, ui_state: { ...currentState, organizationChart: nextChart } }, { onConflict: 'auth_user_id' })
  if (error) return false
  return true
}
