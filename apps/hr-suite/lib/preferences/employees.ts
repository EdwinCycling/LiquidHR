import 'server-only'

import type { Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import {
  parseEmployeeListPreferences,
  type EmployeeListPreferences,
  type EmployeeListPreferencesPatch,
} from './employee-list-state'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface EmployeeListPreferencesReadDependencies {
  supabase: SupabaseServerClient
  userId: string
}

function isRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withoutFilterPanelOpen(value: { [key: string]: Json | undefined }): { [key: string]: Json | undefined } {
  const cleaned: { [key: string]: Json | undefined } = {}
  for (const [key, item] of Object.entries(value)) {
    if (key !== 'filterPanelOpen') cleaned[key] = item
  }
  return cleaned
}

export async function getStoredEmployeesListPreferences(dependencies?: EmployeeListPreferencesReadDependencies): Promise<EmployeeListPreferences> {
  const supabase = dependencies?.supabase ?? await createClient()
  const userId = dependencies?.userId ?? (await supabase.auth.getClaims()).data?.claims.sub
  if (!userId) return parseEmployeeListPreferences(null)
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  if (!isRecord(data?.ui_state)) return parseEmployeeListPreferences(null)
  return parseEmployeeListPreferences(data.ui_state.employeesList)
}

export async function saveEmployeesListPreferences(patch: EmployeeListPreferencesPatch): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return false
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const currentState = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const currentEmployeesList = isRecord(currentState.employeesList) ? withoutFilterPanelOpen(currentState.employeesList) : {}
  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    ui_state: {
      ...currentState,
      employeesList: {
        ...currentEmployeesList,
        ...patch,
      },
    },
  }, { onConflict: 'auth_user_id' })
  if (error) return false
  return true
}
