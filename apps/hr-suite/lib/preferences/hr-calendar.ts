import 'server-only'

import type { Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'

function isRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function getStoredHrCalendarFilterPanelOpen(): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return true
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  if (!isRecord(data?.ui_state) || !isRecord(data.ui_state.hrCalendar)) return true
  return data.ui_state.hrCalendar.filterPanelOpen !== false
}

export async function saveHrCalendarFilterPanelOpen(filterPanelOpen: boolean): Promise<boolean> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return false
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const currentState = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const currentCalendar = isRecord(currentState.hrCalendar) ? currentState.hrCalendar : {}
  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    ui_state: {
      ...currentState,
      hrCalendar: {
        ...currentCalendar,
        filterPanelOpen,
      },
    },
  }, { onConflict: 'auth_user_id' })
  if (error) return false
  return true
}
