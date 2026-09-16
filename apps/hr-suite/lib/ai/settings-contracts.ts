import type { AiQualityProfile } from './contracts'

export const AI_SETTINGS_ROLE_CODES = [
  'EMPLOYEE',
  'DIRECT_MANAGER',
  'TEAM_LEAD',
  'HR_ADVISOR',
  'PAYROLL_SPECIALIST',
  'HR_ADMIN',
  'TENANT_ADMIN',
] as const

export type AiSettingsRoleCode = (typeof AI_SETTINGS_ROLE_CODES)[number]

export const AI_SETTINGS_CAPABILITY_CODES = [
  'IMPROVE_EXISTING_HR_TEXT',
  'EMPLOYEE_SUMMARY',
  'CONVERSATION_PREPARATION',
  'DEVELOPMENT_GOAL_SMART',
  'VACANCY_DRAFT',
  'TEAM_SUMMARY',
  'VOICE',
] as const

export type AiSettingsCapabilityCode = (typeof AI_SETTINGS_CAPABILITY_CODES)[number]

export const AI_SUPPORTED_VOICE_IDS = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const
export type AiSupportedVoiceId = (typeof AI_SUPPORTED_VOICE_IDS)[number]

export type AiConversationStyle = 'NEUTRAL' | 'BUSINESS' | 'COACHING'
export type AiAnswerLength = 'SHORT' | 'NORMAL' | 'DETAILED'

export interface AiRolePolicy {
  aiEnabled: boolean
  voiceEnabled: boolean
}
export type AiRolePolicies = Record<AiSettingsRoleCode, AiRolePolicy>
export type AiCapabilitySettings = Record<AiSettingsCapabilityCode, boolean>

export interface AiGroupSettings {
  id: string | null
  tenantId: string
  hrGroupId: string
  aiEnabled: boolean
  voiceEnabled: boolean
  employeeAiEnabled: boolean
  teamAiEnabled: boolean
  qualityProfile: AiQualityProfile
  conversationStyle: AiConversationStyle
  answerLength: AiAnswerLength
  voiceId: AiSupportedVoiceId
  maxVoiceSessionSeconds: number
  endSummaryEnabled: boolean
  employeeNoteSaveEnabled: boolean
  teamLogbookSaveEnabled: boolean
  rolePolicies: AiRolePolicies
  capabilities: AiCapabilitySettings
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

function defaultRolePolicies(): AiRolePolicies {
  return Object.fromEntries(AI_SETTINGS_ROLE_CODES.map((role) => [role, { aiEnabled: true, voiceEnabled: true }])) as AiRolePolicies
}

function defaultCapabilities(): AiCapabilitySettings {
  return Object.fromEntries(AI_SETTINGS_CAPABILITY_CODES.map((capability) => [capability, true])) as AiCapabilitySettings
}

export function defaultAiGroupSettings(scope: { tenantId: string; hrGroupId: string }): AiGroupSettings {
  return {
    id: null,
    tenantId: scope.tenantId,
    hrGroupId: scope.hrGroupId,
    aiEnabled: true,
    voiceEnabled: true,
    employeeAiEnabled: true,
    teamAiEnabled: true,
    qualityProfile: 'EFFICIENT',
    conversationStyle: 'NEUTRAL',
    answerLength: 'NORMAL',
    voiceId: 'alloy',
    maxVoiceSessionSeconds: 1_800,
    endSummaryEnabled: true,
    employeeNoteSaveEnabled: false,
    teamLogbookSaveEnabled: true,
    rolePolicies: defaultRolePolicies(),
    capabilities: defaultCapabilities(),
    updatedBy: null,
    createdAt: null,
   updatedAt: null,
 }
}
