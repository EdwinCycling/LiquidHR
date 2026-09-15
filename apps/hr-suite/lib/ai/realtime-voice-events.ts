export type RealtimeVoiceToolName = 'employee_summary' | 'conversation_preparation' | 'development_goal_smart' | 'create_personal_reminder'
export type TeamRealtimeVoiceToolName = 'team_overview' | 'team_employee_summary' | 'team_conversation_preparation' | 'team_summary_proposal' | 'create_personal_reminder'

export interface RealtimeVoiceFunctionCall {
  callId: string
  name: RealtimeVoiceToolName
  arguments: unknown
}

const realtimeVoiceToolNames = new Set<RealtimeVoiceToolName>(['employee_summary', 'conversation_preparation', 'development_goal_smart', 'create_personal_reminder'])
const teamRealtimeVoiceToolNames = new Set<TeamRealtimeVoiceToolName>(['team_overview', 'team_employee_summary', 'team_conversation_preparation', 'team_summary_proposal', 'create_personal_reminder'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function completedFunctionCallItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  const event = value.type === 'response.event' && isRecord(value.event) ? value.event : value
  if (event.type !== 'response.output_item.done' || !isRecord(event.item)) return null
  return event.item
}

export function parseRealtimeVoiceFunctionCall(value: unknown): RealtimeVoiceFunctionCall | null {
  const item = completedFunctionCallItem(value)
  if (!isRecord(item) || item.type !== 'function_call' || typeof item.call_id !== 'string' || !item.call_id.trim() || typeof item.name !== 'string' || !realtimeVoiceToolNames.has(item.name as RealtimeVoiceToolName)) return null
  let parsedArguments: unknown = {}
  if (typeof item.arguments === 'string') {
    try { parsedArguments = JSON.parse(item.arguments) as unknown } catch { return null }
  } else if (item.arguments !== undefined) {
    parsedArguments = item.arguments
  }
  return { callId: item.call_id, name: item.name as RealtimeVoiceToolName, arguments: parsedArguments }
}

export function parseTeamRealtimeVoiceFunctionCall(value: unknown): { callId: string; name: TeamRealtimeVoiceToolName; arguments: unknown } | null {
  const item = completedFunctionCallItem(value)
  if (!isRecord(item) || item.type !== 'function_call' || typeof item.call_id !== 'string' || !item.call_id.trim() || typeof item.name !== 'string' || !teamRealtimeVoiceToolNames.has(item.name as TeamRealtimeVoiceToolName)) return null
  let parsedArguments: unknown = {}
  if (typeof item.arguments === 'string') {
    try { parsedArguments = JSON.parse(item.arguments) as unknown } catch { return null }
  } else if (item.arguments !== undefined) {
    parsedArguments = item.arguments
  }
  return { callId: item.call_id, name: item.name as TeamRealtimeVoiceToolName, arguments: parsedArguments }
}
