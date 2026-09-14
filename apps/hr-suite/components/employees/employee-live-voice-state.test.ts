import { describe, expect, it } from 'vitest'

import {
  employeeLiveVoiceReducer,
  initialEmployeeLiveVoiceState,
  type EmployeeLiveVoiceState,
} from './employee-live-voice-state'

describe('EmployeeLiveVoice state machine', () => {
  it('uses one authoritative lifecycle from connecting through spoken output', () => {
    let state: EmployeeLiveVoiceState = initialEmployeeLiveVoiceState
    state = employeeLiveVoiceReducer(state, { type: 'start' })
    state = employeeLiveVoiceReducer(state, { type: 'session.started' })
    state = employeeLiveVoiceReducer(state, { type: 'response.created' })
    state = employeeLiveVoiceReducer(state, { type: 'output_audio.started' })
    expect(state).toEqual({ phase: 'speaking' })

    state = employeeLiveVoiceReducer(state, { type: 'input_audio.speech_started' })
    expect(state).toEqual({ phase: 'listening' })
    state = employeeLiveVoiceReducer(state, { type: 'stop' })
    expect(state).toEqual({ phase: 'closing' })
    expect(employeeLiveVoiceReducer(state, { type: 'closed' })).toEqual({ phase: 'idle' })
  })

  it('restores the exact pre-mute phase and never exposes contradictory active flags', () => {
    const speaking = { phase: 'speaking' } as const
    const muted = employeeLiveVoiceReducer(speaking, { type: 'mute' })
    expect(muted).toEqual({ phase: 'muted', resumePhase: 'speaking' })
    expect(employeeLiveVoiceReducer(muted, { type: 'unmute' })).toEqual(speaking)
  })

  it('keeps provider and tool failures inside the controlled error state', () => {
    const connecting = employeeLiveVoiceReducer(initialEmployeeLiveVoiceState, { type: 'start' })
    expect(employeeLiveVoiceReducer(connecting, { type: 'error', message: 'connectionFailed' })).toEqual({ phase: 'error', message: 'connectionFailed' })
    expect(employeeLiveVoiceReducer({ phase: 'processing' }, { type: 'tool.failed' })).toEqual({ phase: 'error', message: 'toolFailed' })
    expect(employeeLiveVoiceReducer(initialEmployeeLiveVoiceState, { type: 'error', message: 'connectionFailed' })).toEqual(initialEmployeeLiveVoiceState)
  })
})
