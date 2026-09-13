export type RealtimeVoiceToolName = 'employee_summary' | 'conversation_preparation' | 'development_goal_smart'

export interface RealtimeVoiceFunctionCall {
  callId: string
  name: RealtimeVoiceToolName
  arguments: unknown
}

const realtimeVoiceToolNames = new Set<RealtimeVoiceToolName>(['employee_summary', 'conversation_preparation', 'development_goal_smart'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRealtimeVoiceFunctionCall(value: unknown): RealtimeVoiceFunctionCall | null {
  if (!isRecord(value) || value.type !== 'response.event' || !isRecord(value.event) || value.event.type !== 'response.output_item.done') return null
  const item = value.event.item
  if (!isRecord(item) || item.type !== 'function_call' || typeof item.call_id !== 'string' || !item.call_id.trim() || typeof item.name !== 'string' || !realtimeVoiceToolNames.has(item.name as RealtimeVoiceToolName)) return null
  let parsedArguments: unknown = {}
  if (typeof item.arguments === 'string') {
    try { parsedArguments = JSON.parse(item.arguments) as unknown } catch { return null }
  } else if (item.arguments !== undefined) {
    parsedArguments = item.arguments
  }
  return { callId: item.call_id, name: item.name as RealtimeVoiceToolName, arguments: parsedArguments }
}
