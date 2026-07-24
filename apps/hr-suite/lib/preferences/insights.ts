import 'server-only'

import type { Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import type { EmployeeInsightReportId } from '@/lib/insights/types'

export interface StoredInsightFilters {
  groupBy?: string
  year?: number
  month?: number
  fullYear?: boolean
  sortBy?: string
  teams?: string[]
  segments?: string[]
  reasons?: string[]
  employeeStatus?: 'all' | 'active' | 'former'
}

export interface InsightsPreferences {
  preserveFilters: boolean
  selectionPanelOpen: boolean
  filters: Partial<Record<EmployeeInsightReportId, StoredInsightFilters>>
}

const employeeReports: readonly EmployeeInsightReportId[] = ['employee-department', 'employee-gender', 'employee-age', 'terminations']

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringArray(value: Json | undefined): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.length <= 160)) return undefined
  return value as string[]
}

function readFilters(value: Json | undefined): StoredInsightFilters | undefined {
  if (!isRecord(value)) return undefined
  const filters: StoredInsightFilters = {}
  if (typeof value.groupBy === 'string' && value.groupBy.length <= 32) filters.groupBy = value.groupBy
  if (typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 2000 && value.year <= 2100) filters.year = value.year
  if (typeof value.month === 'number' && Number.isInteger(value.month) && value.month >= 1 && value.month <= 12) filters.month = value.month
  if (typeof value.fullYear === 'boolean') filters.fullYear = value.fullYear
  if (typeof value.sortBy === 'string' && value.sortBy.length <= 32) filters.sortBy = value.sortBy
  const teams = readStringArray(value.teams); if (teams) filters.teams = teams
  const segments = readStringArray(value.segments); if (segments) filters.segments = segments
  const reasons = readStringArray(value.reasons); if (reasons) filters.reasons = reasons
  if (value.employeeStatus === 'all' || value.employeeStatus === 'active' || value.employeeStatus === 'former') filters.employeeStatus = value.employeeStatus
  return filters
}

export async function getInsightsPreferences(): Promise<InsightsPreferences> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return { preserveFilters: false, selectionPanelOpen: true, filters: {} }
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  if (!isRecord(data?.ui_state) || !isRecord(data.ui_state.insights)) return { preserveFilters: false, selectionPanelOpen: true, filters: {} }
  const state = data.ui_state.insights
  const filters: Partial<Record<EmployeeInsightReportId, StoredInsightFilters>> = {}
  if (isRecord(state.filters)) {
    for (const report of employeeReports) {
      const parsed = readFilters(state.filters[report])
      if (parsed) filters[report] = parsed
    }
  }
  return { preserveFilters: state.preserveFilters === true, selectionPanelOpen: state.selectionPanelOpen !== false, filters }
}

export async function saveInsightsPreferences(input: Pick<InsightsPreferences, 'preserveFilters' | 'selectionPanelOpen'> & { report?: EmployeeInsightReportId; filters?: StoredInsightFilters }): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return false
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const currentState = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const currentInsights = isRecord(currentState.insights) ? currentState.insights : {}
  const currentFilters = isRecord(currentInsights.filters) ? currentInsights.filters : {}
  const filters = { ...currentFilters }
  if (input.preserveFilters && input.report && input.filters) filters[input.report] = input.filters as Json
  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    ui_state: { ...currentState, insights: { ...currentInsights, preserveFilters: input.preserveFilters, selectionPanelOpen: input.selectionPanelOpen, filters } },
  }, { onConflict: 'auth_user_id' })
  return !error
}
