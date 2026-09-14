export type EmployeeLiveVoiceActivePhase = 'listening' | 'processing' | 'speaking'

export type EmployeeLiveVoiceError = 'microphoneDenied' | 'connectionFailed' | 'toolFailed'

export type EmployeeLiveVoiceState =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: EmployeeLiveVoiceActivePhase }
  | { phase: 'muted'; resumePhase: EmployeeLiveVoiceActivePhase }
  | { phase: 'error'; message: EmployeeLiveVoiceError }
  | { phase: 'closing' }

export type EmployeeLiveVoiceEvent =
  | { type: 'start' }
  | { type: 'session.started' }
  | { type: 'response.created' }
  | { type: 'output_audio.started' }
  | { type: 'output_audio.stopped' }
  | { type: 'input_audio.speech_started' }
  | { type: 'input_transcript.delta' }
  | { type: 'tool.started' }
  | { type: 'tool.failed' }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'stop' }
  | { type: 'closed' }
  | { type: 'error'; message: EmployeeLiveVoiceError }
  | { type: 'reset' }

export const initialEmployeeLiveVoiceState: EmployeeLiveVoiceState = { phase: 'idle' }

function isActive(state: EmployeeLiveVoiceState): state is { phase: EmployeeLiveVoiceActivePhase } {
  return state.phase === 'listening' || state.phase === 'processing' || state.phase === 'speaking'
}

export function employeeLiveVoiceReducer(state: EmployeeLiveVoiceState, event: EmployeeLiveVoiceEvent): EmployeeLiveVoiceState {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' || state.phase === 'error' ? { phase: 'connecting' } : state
    case 'session.started':
      return state.phase === 'connecting' ? { phase: 'listening' } : state
    case 'response.created':
    case 'tool.started':
      return isActive(state) ? { phase: 'processing' } : state
    case 'output_audio.started':
      return isActive(state) ? { phase: 'speaking' } : state
    case 'output_audio.stopped':
    case 'input_audio.speech_started':
    case 'input_transcript.delta':
      return isActive(state) ? { phase: 'listening' } : state
    case 'tool.failed':
      return isActive(state) || state.phase === 'muted' ? { phase: 'error', message: 'toolFailed' } : state
    case 'mute':
      return isActive(state) ? { phase: 'muted', resumePhase: state.phase } : state
    case 'unmute':
      return state.phase === 'muted' ? { phase: state.resumePhase } : state
    case 'stop':
      return state.phase === 'idle' || state.phase === 'closing' ? state : { phase: 'closing' }
    case 'closed':
    case 'reset':
      return { phase: 'idle' }
    case 'error':
      return state.phase === 'idle' ? state : { phase: 'error', message: event.message }
    default:
      return state
  }
}
