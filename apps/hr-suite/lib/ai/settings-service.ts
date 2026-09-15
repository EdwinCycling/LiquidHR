import 'server-only'

import type { Database, TablesInsert } from '@scope/db'
import { z } from 'zod'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { AiExecutionError, type AiInvocationContextType, type AiInvocationOrigin, type AiScope, type AiSettingsPort } from './contracts'
import {
  AI_SETTINGS_CAPABILITY_CODES,
  AI_SETTINGS_ROLE_CODES,
  AI_SUPPORTED_VOICE_IDS,
  defaultAiGroupSettings,
  type AiAnswerLength,
  type AiCapabilitySettings,
  type AiConversationStyle,
  type AiGroupSettings,
  type AiRolePolicies,
  type AiSettingsCapabilityCode,
  type AiSettingsRoleCode,
  type AiSupportedVoiceId,
} from './settings-contracts'

const rolePolicySchema = z.object({ aiEnabled: z.boolean(), voiceEnabled: z.boolean() }).strict()
const rolePoliciesSchema = z.object(Object.fromEntries(AI_SETTINGS_ROLE_CODES.map((role) => [role, rolePolicySchema])) as Record<AiSettingsRoleCode, typeof rolePolicySchema>).strict()
const capabilitySettingsSchema = z.object(Object.fromEntries(AI_SETTINGS_CAPABILITY_CODES.map((capability) => [capability, z.boolean()])) as Record<AiSettingsCapabilityCode, z.ZodBoolean>).strict()

export const aiGroupSettingsInputSchema = z.object({
  aiEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  employeeAiEnabled: z.boolean(),
  teamAiEnabled: z.boolean(),
  qualityProfile: z.enum(['EFFICIENT', 'BALANCED', 'IN_DEPTH']),
  conversationStyle: z.enum(['NEUTRAL', 'BUSINESS', 'COACHING']),
  answerLength: z.enum(['SHORT', 'NORMAL', 'DETAILED']),
  voiceId: z.enum(AI_SUPPORTED_VOICE_IDS),
  maxVoiceSessionSeconds: z.number().int().min(30).max(3_600),
  endSummaryEnabled: z.boolean(),
  employeeNoteSaveEnabled: z.boolean(),
  teamLogbookSaveEnabled: z.boolean(),
  rolePolicies: rolePoliciesSchema,
  capabilities: capabilitySettingsSchema,
}).strict()

export type AiGroupSettingsInput = z.infer<typeof aiGroupSettingsInputSchema>

type SettingsRow = Database['public']['Tables']['ai_group_settings']['Row']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value as T
}

function mapRolePolicies(value: unknown): AiRolePolicies {
  if (!isRecord(value)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  const result = {} as AiRolePolicies
  for (const role of AI_SETTINGS_ROLE_CODES) {
    const policy = value[role]
    if (!isRecord(policy) || typeof policy.aiEnabled !== 'boolean' || typeof policy.voiceEnabled !== 'boolean') {
      throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    }
    result[role] = { aiEnabled: policy.aiEnabled, voiceEnabled: policy.voiceEnabled }
  }
  return result
}

function mapCapabilities(value: unknown): AiCapabilitySettings {
  if (!isRecord(value)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  const result = {} as AiCapabilitySettings
  for (const capability of AI_SETTINGS_CAPABILITY_CODES) {
    if (typeof value[capability] !== 'boolean') throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    result[capability] = value[capability]
  }
  return result
}

function mapSettingsRow(row: SettingsRow): AiGroupSettings {
  if (!Number.isInteger(row.max_voice_session_seconds) || row.max_voice_session_seconds < 30 || row.max_voice_session_seconds > 3_600) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  return {
    id: requiredText(row.id),
    tenantId: requiredText(row.tenant_id),
    hrGroupId: requiredText(row.hr_group_id),
    aiEnabled: row.ai_enabled,
    voiceEnabled: row.voice_enabled,
    employeeAiEnabled: row.employee_ai_enabled,
    teamAiEnabled: row.team_ai_enabled,
    qualityProfile: enumValue(row.quality_profile, ['EFFICIENT', 'BALANCED', 'IN_DEPTH']),
    conversationStyle: enumValue(row.conversation_style, ['NEUTRAL', 'BUSINESS', 'COACHING']),
    answerLength: enumValue(row.answer_length, ['SHORT', 'NORMAL', 'DETAILED']),
    voiceId: enumValue(row.voice_id, AI_SUPPORTED_VOICE_IDS),
    maxVoiceSessionSeconds: row.max_voice_session_seconds,
    endSummaryEnabled: row.end_summary_enabled,
    employeeNoteSaveEnabled: row.employee_note_save_enabled,
    teamLogbookSaveEnabled: row.team_logbook_save_enabled,
    rolePolicies: mapRolePolicies(row.role_policies),
    capabilities: mapCapabilities(row.capability_settings),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowInput(input: AiGroupSettingsInput, scope: AiScope, userId: string): TablesInsert<'ai_group_settings'> {
  return {
    tenant_id: scope.tenantId,
    hr_group_id: scope.hrGroupId,
    ai_enabled: input.aiEnabled,
    voice_enabled: input.voiceEnabled,
    employee_ai_enabled: input.employeeAiEnabled,
    team_ai_enabled: input.teamAiEnabled,
    quality_profile: input.qualityProfile,
    conversation_style: input.conversationStyle,
    answer_length: input.answerLength,
    voice_id: input.voiceId,
    max_voice_session_seconds: input.maxVoiceSessionSeconds,
    end_summary_enabled: input.endSummaryEnabled,
    employee_note_save_enabled: input.employeeNoteSaveEnabled,
    team_logbook_save_enabled: input.teamLogbookSaveEnabled,
    role_policies: input.rolePolicies,
    capability_settings: input.capabilities,
    updated_by: userId,
  }
}

export function evaluateAiSettingsAccess(input: {
  settings: AiGroupSettings
  activeRoles: readonly string[]
  featureCode: string
  contextType?: AiInvocationContextType
  origin?: AiInvocationOrigin
}): 'ALLOWED' | 'AI_DISABLED' | 'FEATURE_UNAVAILABLE' | 'UNAUTHORIZED' {
  const { settings } = input
  if (!settings.aiEnabled) return 'AI_DISABLED'
  const contextType = input.contextType ?? 'GLOBAL'
  if (contextType === 'EMPLOYEE' && !settings.employeeAiEnabled) return 'FEATURE_UNAVAILABLE'
  if (contextType === 'TEAM' && !settings.teamAiEnabled) return 'FEATURE_UNAVAILABLE'
  const capabilityByFeatureCode: Readonly<Record<string, AiSettingsCapabilityCode>> = {
    'improve-existing-hr-text': 'IMPROVE_EXISTING_HR_TEXT',
    EMPLOYEE_SUMMARY: 'EMPLOYEE_SUMMARY',
    CONVERSATION_PREPARATION: 'CONVERSATION_PREPARATION',
    DEVELOPMENT_GOAL_SMART: 'DEVELOPMENT_GOAL_SMART',
    VACANCY_DRAFT: 'VACANCY_DRAFT',
    TEAM_SUMMARY: 'TEAM_SUMMARY',
  }
  if (input.origin === 'VOICE' && (!settings.voiceEnabled || !settings.capabilities.VOICE)) return 'FEATURE_UNAVAILABLE'
  const capability = capabilityByFeatureCode[input.featureCode]
  if (capability && !settings.capabilities[capability]) return 'FEATURE_UNAVAILABLE'
  const allowedRole = input.activeRoles.some((role) => {
    if (!AI_SETTINGS_ROLE_CODES.includes(role as AiSettingsRoleCode)) return false
    const policy = settings.rolePolicies[role as AiSettingsRoleCode]
    return input.origin === 'VOICE' ? policy.voiceEnabled : policy.aiEnabled
  })
  return allowedRole ? 'ALLOWED' : 'UNAUTHORIZED'
}

function throwAccessFailure(result: ReturnType<typeof evaluateAiSettingsAccess>): void {
  if (result === 'AI_DISABLED') throw new AiExecutionError('AI_DISABLED')
  if (result === 'UNAUTHORIZED') throw new AiExecutionError('UNAUTHORIZED')
  if (result === 'FEATURE_UNAVAILABLE') throw new AiExecutionError('FEATURE_UNAVAILABLE')
}

async function readSettings(scope: AiScope, useAuthenticatedClient: boolean): Promise<AiGroupSettings> {
  const client = useAuthenticatedClient ? await createClient() : createAdminClient()
  const result = await client
    .from('ai_group_settings')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .maybeSingle()
  if (result.error) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  if (!result.data) return defaultAiGroupSettings(scope)
  return mapSettingsRow(result.data)
}

export async function getAiGroupSettings(scope: AiScope): Promise<AiGroupSettings> {
  return readSettings(scope, false)
}

export async function getAiGroupSettingsForContext(context: AuthContext): Promise<AiGroupSettings> {
  return getAiGroupSettings({ tenantId: context.tenantId, hrGroupId: requireHrGroupId(context), administrationId: context.administrationId })
}

export async function getAiAdminSettings(): Promise<AiGroupSettings> {
  const context = await requirePermission('ai:manage')
  const scope: AiScope = { tenantId: context.tenantId, hrGroupId: requireHrGroupId(context), administrationId: context.administrationId }
  return readSettings(scope, true)
}

export async function updateAiAdminSettings(rawInput: unknown): Promise<AiGroupSettings> {
  const context = await requirePermission('ai:manage')
  const scope: AiScope = { tenantId: context.tenantId, hrGroupId: requireHrGroupId(context), administrationId: context.administrationId }
  const input = aiGroupSettingsInputSchema.parse(rawInput)
  const result = await (await createClient())
    .from('ai_group_settings')
    .upsert(rowInput(input, scope, context.userId), { onConflict: 'tenant_id,hr_group_id' })
    .select('*')
    .single()
  if (result.error || !result.data) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return mapSettingsRow(result.data)
}

export class SupabaseAiSettingsPort implements AiSettingsPort {
  async resolve(scope: AiScope): Promise<AiGroupSettings> {
    return getAiGroupSettings(scope)
  }

  async assertInvocationAllowed(input: { scope: AiScope; authContext: AuthContext; featureCode: string; contextType?: AiInvocationContextType; origin?: AiInvocationOrigin }): Promise<AiGroupSettings> {
    const settings = await getAiGroupSettings(input.scope)
    throwAccessFailure(evaluateAiSettingsAccess({ settings, activeRoles: input.authContext.activeRoles, featureCode: input.featureCode, contextType: input.contextType, origin: input.origin }))
    return settings
  }

  async assertVoiceAllowed(input: { scope: AiScope; authContext: AuthContext; contextType: 'EMPLOYEE' | 'TEAM' }): Promise<AiGroupSettings> {
    const settings = await getAiGroupSettings(input.scope)
    throwAccessFailure(evaluateAiSettingsAccess({ settings, activeRoles: input.authContext.activeRoles, featureCode: 'VOICE', contextType: input.contextType, origin: 'VOICE' }))
    return settings
  }
}

export function settingsInputFromGroup(settings: AiGroupSettings): AiGroupSettingsInput {
  return {
    aiEnabled: settings.aiEnabled,
    voiceEnabled: settings.voiceEnabled,
    employeeAiEnabled: settings.employeeAiEnabled,
    teamAiEnabled: settings.teamAiEnabled,
    qualityProfile: settings.qualityProfile,
    conversationStyle: settings.conversationStyle,
    answerLength: settings.answerLength,
    voiceId: settings.voiceId,
    maxVoiceSessionSeconds: settings.maxVoiceSessionSeconds,
    endSummaryEnabled: settings.endSummaryEnabled,
    employeeNoteSaveEnabled: settings.employeeNoteSaveEnabled,
    teamLogbookSaveEnabled: settings.teamLogbookSaveEnabled,
    rolePolicies: settings.rolePolicies,
    capabilities: settings.capabilities,
  }
}

export type { AiAnswerLength, AiConversationStyle, AiSupportedVoiceId }
