import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  HeRaDetailLevel,
  HeRaLocale,
  HeRaMemoryItem,
  HeRaSeniorityLevel,
  HeRaTone,
  HeRaUserContext,
} from './types'

interface HeRaOwnerScope {
  tenantId: string
  userId: string
}

interface StoredAgentPreference {
  tone: HeRaTone
  detailLevel: HeRaDetailLevel
  seniorityLevel: HeRaSeniorityLevel
}

export interface HeRaUserContextDependencies {
  loadInterfaceLocale?: () => Promise<HeRaLocale>
  loadAgentPreference?: (scope: HeRaOwnerScope) => Promise<StoredAgentPreference | null>
  loadMemory?: (scope: HeRaOwnerScope) => Promise<HeRaMemoryItem[]>
}

const storedPreferenceSchema = z.object({
  tone: z.enum(['FRIENDLY', 'BUSINESS', 'DIRECT']),
  detail_level: z.enum(['COMPACT', 'BALANCED', 'EXTENDED']),
  seniority_level: z.enum(['BASIC', 'EXPERIENCED', 'EXPERT']),
}).strict()

const memoryRowsSchema = z.array(z.object({
  id: z.string().uuid(),
  category: z.enum(['PREFERENCE', 'WORKING_CONTEXT']),
  content: z.string().min(1).max(1000),
}).strict())

const DEFAULT_AGENT_PREFERENCE: StoredAgentPreference = {
  tone: 'BUSINESS',
  detailLevel: 'BALANCED',
  seniorityLevel: 'EXPERIENCED',
}

async function loadInterfaceLocale(): Promise<HeRaLocale> {
  const { getUserPreferences } = await import('@/lib/preferences/server')
  return (await getUserPreferences()).locale
}

async function loadAgentPreference(scope: HeRaOwnerScope): Promise<StoredAgentPreference | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_user_preferences')
    .select('tone, detail_level, seniority_level')
    .eq('tenant_id', scope.tenantId)
    .eq('owner_user_id', scope.userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const parsed = storedPreferenceSchema.parse(data)
  return {
    tone: parsed.tone,
    detailLevel: parsed.detail_level,
    seniorityLevel: parsed.seniority_level,
  }
}

async function loadMemory(scope: HeRaOwnerScope): Promise<HeRaMemoryItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_memory_items')
    .select('id, category, content')
    .eq('tenant_id', scope.tenantId)
    .eq('owner_user_id', scope.userId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return memoryRowsSchema.parse(data)
}

export async function loadHeRaUserContext(
  context: AuthContext,
  dependencies: HeRaUserContextDependencies = {},
): Promise<HeRaUserContext> {
  const scope = { tenantId: context.tenantId, userId: context.userId }
  const [locale, storedPreference, memory] = await Promise.all([
    (dependencies.loadInterfaceLocale ?? loadInterfaceLocale)(),
    (dependencies.loadAgentPreference ?? loadAgentPreference)(scope),
    (dependencies.loadMemory ?? loadMemory)(scope),
  ])
  const preference = storedPreference ?? DEFAULT_AGENT_PREFERENCE

  return {
    locale,
    timeZone: 'Europe/Amsterdam',
    ...preference,
    memory,
  }
}
