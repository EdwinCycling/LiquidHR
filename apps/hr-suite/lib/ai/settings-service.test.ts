import { describe, expect, it } from 'vitest'
import { defaultAiGroupSettings } from './settings-contracts'
import { aiGroupSettingsInputSchema, evaluateAiSettingsAccess } from './settings-service'

const scope = { tenantId: 'tenant-1', hrGroupId: 'group-1' }

describe('AI group settings policy', () => {
  it('defaults to enabled, group-scoped settings without requiring a seed row', () => {
    const settings = defaultAiGroupSettings(scope)
    expect(settings).toMatchObject({ ...scope, aiEnabled: true, voiceEnabled: true, employeeAiEnabled: true, teamAiEnabled: true, voiceId: 'alloy', maxVoiceSessionSeconds: 1800 })
    expect(settings.capabilities.VOICE).toBe(true)
    expect(settings.rolePolicies.HR_ADMIN).toEqual({ aiEnabled: true, voiceEnabled: true })
  })

  it('requires both the AI permission role policy and the selected capability/context', () => {
    const settings = defaultAiGroupSettings(scope)
    expect(evaluateAiSettingsAccess({ settings, activeRoles: ['HR_ADMIN'], featureCode: 'EMPLOYEE_SUMMARY', contextType: 'EMPLOYEE' })).toBe('ALLOWED')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, capabilities: { ...settings.capabilities, EMPLOYEE_SUMMARY: false } }, activeRoles: ['HR_ADMIN'], featureCode: 'EMPLOYEE_SUMMARY', contextType: 'EMPLOYEE' })).toBe('FEATURE_UNAVAILABLE')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, rolePolicies: { ...settings.rolePolicies, EMPLOYEE: { aiEnabled: false, voiceEnabled: true } } }, activeRoles: ['EMPLOYEE'], featureCode: 'EMPLOYEE_SUMMARY', contextType: 'EMPLOYEE' })).toBe('UNAUTHORIZED')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, employeeAiEnabled: false }, activeRoles: ['HR_ADMIN'], featureCode: 'EMPLOYEE_SUMMARY', contextType: 'EMPLOYEE' })).toBe('FEATURE_UNAVAILABLE')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, teamAiEnabled: false }, activeRoles: ['HR_ADMIN'], featureCode: 'TEAM_SUMMARY', contextType: 'TEAM' })).toBe('FEATURE_UNAVAILABLE')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, employeeAiEnabled: false }, activeRoles: ['HR_ADMIN'], featureCode: 'VACANCY_DRAFT', contextType: 'GLOBAL' })).toBe('ALLOWED')
  })

  it('keeps voice fail-closed at both the global/capability and role gates', () => {
    const settings = defaultAiGroupSettings(scope)
    expect(evaluateAiSettingsAccess({ settings, activeRoles: ['HR_ADMIN'], featureCode: 'VOICE', contextType: 'TEAM', origin: 'VOICE' })).toBe('ALLOWED')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, voiceEnabled: false }, activeRoles: ['HR_ADMIN'], featureCode: 'VOICE', contextType: 'TEAM', origin: 'VOICE' })).toBe('FEATURE_UNAVAILABLE')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, capabilities: { ...settings.capabilities, VOICE: false } }, activeRoles: ['HR_ADMIN'], featureCode: 'VOICE', contextType: 'TEAM', origin: 'VOICE' })).toBe('FEATURE_UNAVAILABLE')
    expect(evaluateAiSettingsAccess({ settings: { ...settings, rolePolicies: { ...settings.rolePolicies, HR_ADMIN: { aiEnabled: true, voiceEnabled: false } } }, activeRoles: ['HR_ADMIN'], featureCode: 'VOICE', contextType: 'TEAM', origin: 'VOICE' })).toBe('UNAUTHORIZED')
  })

  it('rejects unknown settings fields and unsafe voice duration values', () => {
    const settings = defaultAiGroupSettings(scope)
    const input = {
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
    expect(aiGroupSettingsInputSchema.parse(input)).toEqual(input)
    expect(() => aiGroupSettingsInputSchema.parse({ ...input, unknown: true })).toThrow()
    expect(() => aiGroupSettingsInputSchema.parse({ ...input, maxVoiceSessionSeconds: 29 })).toThrow()
  })
})
