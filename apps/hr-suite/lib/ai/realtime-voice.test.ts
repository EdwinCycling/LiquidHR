import { describe, expect, it } from 'vitest'

import { createRealtimeVoiceSessionConfiguration, isRealtimeVoiceEnabled, parseRealtimeVoiceToolArguments } from './realtime-voice'

describe('GPT-Live employee voice contract', () => {
  it('configures only the three employee-context tools without an employee identifier', () => {
    const configuration = createRealtimeVoiceSessionConfiguration('nl')
    expect(configuration).toMatchObject({ type: 'realtime', output_modalities: ['audio'], tool_choice: 'auto' })
    expect((configuration.tools as Array<{ name: string }>).map((tool) => tool.name)).toEqual([
      'employee_summary',
      'conversation_preparation',
      'development_goal_smart',
    ])
    expect(JSON.stringify(configuration)).not.toContain('employeeId')
  })

  it('keeps voice disabled in production unless explicitly enabled', () => {
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'production' })).toBe(false)
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'production', AI_REALTIME_VOICE_ENABLED: 'true' })).toBe(true)
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'development' })).toBe(true)
  })

  it('accepts only SMART source text for the SMART tool and rejects model-supplied ids', () => {
    expect(parseRealtimeVoiceToolArguments('employee_summary', {})).toEqual({})
    expect(parseRealtimeVoiceToolArguments('development_goal_smart', { sourceText: 'Beter presenteren.' })).toEqual({ sourceText: 'Beter presenteren.' })
    expect(() => parseRealtimeVoiceToolArguments('employee_summary', { employeeId: 'other-employee' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
    expect(() => parseRealtimeVoiceToolArguments('development_goal_smart', { sourceText: '', employeeId: 'other-employee' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
  })
})
