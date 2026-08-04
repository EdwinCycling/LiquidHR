import 'server-only'

import type { Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_START_PAGE_WINDOW_LAYOUT,
  parseStartPageWindowLayout,
  startPageWindowLayoutJson,
  type StartPageWindowLayout,
} from './start-page-layout'

export type StartPageViewMode = 'full' | 'compact'

export interface StartPagePreferences {
  viewMode: StartPageViewMode
  layout: StartPageWindowLayout
}

export interface StartPagePreferencesPatch {
  viewMode?: StartPageViewMode
  layout?: StartPageWindowLayout
}

export const DEFAULT_START_PAGE_PREFERENCES: StartPagePreferences = {
  viewMode: 'full',
  layout: DEFAULT_START_PAGE_WINDOW_LAYOUT,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseViewMode(value: unknown): StartPageViewMode {
  return value === 'compact' ? 'compact' : 'full'
}

export function parseStartPagePreferences(value: unknown): StartPagePreferences {
  const source = isRecord(value) ? value : {}
  return {
    viewMode: parseViewMode(source.viewMode),
    layout: parseStartPageWindowLayout(source.layout),
  }
}

export function parseStartPagePreferencesPatch(value: unknown): StartPagePreferencesPatch {
  if (!isRecord(value)) return {}
  const patch: StartPagePreferencesPatch = {}
  if (value.viewMode === 'full' || value.viewMode === 'compact') patch.viewMode = value.viewMode
  if (isRecord(value.layout)) patch.layout = parseStartPageWindowLayout(value.layout)
  return patch
}

export function startPagePreferencesJson(preferences: StartPagePreferences): Json {
  const parsed = parseStartPagePreferences(preferences)
  return { viewMode: parsed.viewMode, layout: startPageWindowLayoutJson(parsed.layout) }
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  return claims?.claims.sub ?? null
}

export async function getStartPagePreferences(): Promise<StartPagePreferences> {
  const supabase = await createClient()
  const userId = (await supabase.auth.getClaims()).data?.claims.sub
  if (!userId) return DEFAULT_START_PAGE_PREFERENCES
  const { data } = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const state = isRecord(data?.ui_state) ? data.ui_state : {}
  return parseStartPagePreferences(state.startPage)
}

export async function saveStartPagePreferences(patch: StartPagePreferencesPatch): Promise<StartPagePreferences | null> {
  const supabase = await createClient()
  const userId = await getUserId()
  if (!userId) return null
  const current = await supabase.from('user_preferences').select('ui_state').eq('auth_user_id', userId).maybeSingle()
  const state = isRecord(current.data?.ui_state) ? current.data.ui_state : {}
  const currentPreferences = parseStartPagePreferences(state.startPage)
  const next: StartPagePreferences = {
    viewMode: patch.viewMode ?? currentPreferences.viewMode,
    layout: patch.layout ? parseStartPageWindowLayout(patch.layout) : currentPreferences.layout,
  }
  const { error } = await supabase.from('user_preferences').upsert({
    auth_user_id: userId,
    ui_state: { ...state, startPage: startPagePreferencesJson(next) },
  }, { onConflict: 'auth_user_id' })
  return error ? null : next
}
