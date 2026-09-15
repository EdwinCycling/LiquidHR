import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createOpenAiRealtimeCall,
  createTeamRealtimeVoiceSessionConfiguration,
  createRealtimeVoiceSessionConfiguration,
  isRealtimeVoiceEnabled,
  parseRealtimeVoiceToolArguments,
  parseTeamRealtimeVoiceToolArguments,
  realtimeVoiceSessionRequestSchema,
  teamRealtimeVoiceSessionRequestSchema,
  resolveRealtimeVoiceModel,
} from './realtime-voice'
import { parseRealtimeVoiceFunctionCall, parseTeamRealtimeVoiceFunctionCall } from './realtime-voice-events'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_REALTIME_MODEL
})

describe('GPT-Live employee voice contract', () => {
  it('configures only the three employee-context tools without an employee identifier', () => {
    const configuration = createRealtimeVoiceSessionConfiguration('nl')
    expect(Object.keys(configuration).sort()).toEqual(['client', 'delegation', 'instructions', 'model'])
    expect(configuration).toMatchObject({
      model: 'gpt-live-1',
      delegation: {
        type: 'responses',
        responses: {
          tool_choice: 'auto',
          parallel_tool_calls: false,
        },
      },
    })
    expect(configuration).not.toHaveProperty('output_modalities')
    expect(configuration).not.toHaveProperty('tools')
    expect(configuration).toMatchObject({ client: { data_channel: { allowed_client_events: ['response.item.create', 'response.create', 'response.cancel', 'output_audio_buffer.clear', 'session.close'] } } })
    const delegation = configuration.delegation as { responses: { tools: Array<{ name: string }> } }
    expect(delegation.responses.tools.map((tool) => tool.name)).toEqual([
      'employee_summary',
      'conversation_preparation',
      'development_goal_smart',
      'create_personal_reminder',
    ])
    expect(JSON.stringify(configuration)).not.toContain('employeeId')
  })

  it('keeps voice disabled in production unless explicitly enabled', () => {
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'production' })).toBe(false)
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'production', AI_REALTIME_VOICE_ENABLED: 'true' })).toBe(true)
    expect(isRealtimeVoiceEnabled({ NODE_ENV: 'development' })).toBe(true)
  })

  it('rejects a Realtime model override instead of silently falling back', () => {
    expect(() => resolveRealtimeVoiceModel({ OPENAI_REALTIME_MODEL: 'gpt-realtime-2.1-mini' })).toThrowError(expect.objectContaining({ code: 'INTERNAL_CONFIGURATION_ERROR' }))
    expect(resolveRealtimeVoiceModel({ OPENAI_REALTIME_MODEL: 'gpt-live-1' })).toBe('gpt-live-1')
    expect(resolveRealtimeVoiceModel({})).toBe('gpt-live-1')
  })

  it('parses completed function calls in both direct Live and delegated Responses envelopes', () => {
    expect(parseRealtimeVoiceFunctionCall({
      type: 'response.event',
      event: {
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'call_1', name: 'employee_summary', arguments: '{}' },
      },
    })).toEqual({ callId: 'call_1', name: 'employee_summary', arguments: {} })
    expect(parseRealtimeVoiceFunctionCall({ type: 'response.output_item.done', item: { type: 'function_call', call_id: 'call_direct_1', name: 'employee_summary', arguments: '{}' } })).toEqual({ callId: 'call_direct_1', name: 'employee_summary', arguments: {} })
    expect(parseRealtimeVoiceFunctionCall({
      type: 'response.event',
      event: {
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'call_2', name: 'development_goal_smart', arguments: '{"sourceText":"Beter presenteren."}' },
      },
    })).toEqual({ callId: 'call_2', name: 'development_goal_smart', arguments: { sourceText: 'Beter presenteren.' } })
  })

  it('parses only completed Team AI function calls', () => {
    expect(parseTeamRealtimeVoiceFunctionCall({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'team_1', name: 'team_overview', arguments: '{}' } } })).toEqual({ callId: 'team_1', name: 'team_overview', arguments: {} })
    expect(parseTeamRealtimeVoiceFunctionCall({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'team_2', name: 'team_employee_summary', arguments: '{"employeeName":"Maya Bos"}' } } })).toEqual({ callId: 'team_2', name: 'team_employee_summary', arguments: { employeeName: 'Maya Bos' } })
    expect(parseTeamRealtimeVoiceFunctionCall({ type: 'response.output_item.done', item: { type: 'function_call', call_id: 'team_direct_1', name: 'team_overview', arguments: '{}' } })).toEqual({ callId: 'team_direct_1', name: 'team_overview', arguments: {} })
    expect(parseTeamRealtimeVoiceFunctionCall({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'team_3', name: 'development_goal_smart', arguments: '{}' } } })).toBeNull()
  })

  it('accepts only SMART source text for the SMART tool and rejects model-supplied ids', () => {
    expect(parseRealtimeVoiceToolArguments('employee_summary', {})).toEqual({})
    expect(parseRealtimeVoiceToolArguments('development_goal_smart', { sourceText: 'Beter presenteren.' })).toEqual({ sourceText: 'Beter presenteren.' })
    expect(() => parseRealtimeVoiceToolArguments('employee_summary', { employeeId: 'other-employee' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
    expect(() => parseRealtimeVoiceToolArguments('development_goal_smart', { sourceText: '', employeeId: 'other-employee' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
  })

  it('configures Team AI tools without accepting employee or department ids', () => {
    const configuration = createTeamRealtimeVoiceSessionConfiguration('nl')
    expect(Object.keys(configuration).sort()).toEqual(['client', 'delegation', 'instructions', 'model'])
    expect(configuration).toMatchObject({ model: 'gpt-live-1', delegation: { type: 'responses' } })
    const delegation = configuration.delegation as { responses: { tools: Array<{ name: string; parameters: { properties?: Record<string, unknown> } }> } }
    expect(delegation.responses.tools.map((tool) => tool.name)).toEqual(['team_overview', 'team_employee_summary', 'team_conversation_preparation', 'team_summary_proposal', 'create_personal_reminder'])
    expect(delegation.responses.tools[1]?.parameters.properties).toEqual({ employeeName: { type: 'string', minLength: 1, maxLength: 200 } })
    expect(JSON.stringify(configuration)).not.toContain('employeeId')
    expect(JSON.stringify(configuration)).not.toContain('departmentId')
    expect(parseTeamRealtimeVoiceToolArguments('team_employee_summary', { employeeName: 'Maya Bos' })).toEqual({ employeeName: 'Maya Bos' })
    expect(() => parseTeamRealtimeVoiceToolArguments('team_employee_summary', { employeeId: 'other' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
    expect(() => parseTeamRealtimeVoiceToolArguments('create_personal_reminder', { title: 'Herinnering', remindAt: '2030-01-01T10:00:00+01:00', confirmation: 'EXPLICIT_REQUEST', employeeId: 'other' })).toThrowError(expect.objectContaining({ code: 'INVALID_RESULT' }))
  })

  it('accepts PostgreSQL UUID-shaped department fixture values without weakening the shape check', () => {
    const departmentId = '66c647bd-da37-2097-6c17-78ca6cbec389'
    const parsed = teamRealtimeVoiceSessionRequestSchema.parse({ locale: 'nl', departmentId, sdpOffer: 'v=0\\r\\noffer' })
    expect(parsed.departmentId).toBe(departmentId)
  })

  it('preserves the complete browser SDP offer during request validation', () => {
    const sdpOffer = 'v=0\\r\\noffer\\r\\n\\r\\n'
    const parsed = realtimeVoiceSessionRequestSchema.parse({ locale: 'nl', sdpOffer })
    expect(parsed.sdpOffer).toBe(sdpOffer)
  })

  it('creates a JSON Live WebRTC request and returns only the SDP answer', async () => {
    process.env.OPENAI_API_KEY = 'unit-test-only'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      session: { id: 'live_test' },
      transport: { type: 'webrtc', sdp: 'v=0\\r\\nanswer' },
    }), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'req_test' } }))

    await expect(createOpenAiRealtimeCall({ sdpOffer: 'v=0\\r\\noffer', session: createRealtimeVoiceSessionConfiguration('nl') })).resolves.toBe('v=0\\r\\nanswer')

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.openai.com/v1/live/sessions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      session: { model: 'gpt-live-1' },
      transport: { type: 'webrtc', sdp: 'v=0\\r\\noffer' },
    })
    expect(JSON.parse(String(init?.body)).session).not.toHaveProperty('type')
  })

  it('logs safe provider metadata without forwarding provider details to the caller', async () => {
    process.env.OPENAI_API_KEY = 'unit-test-only'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'unknown_parameter', param: 'session.type' } }), {
      status: 422,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req_safe' },
    }))

    await expect(createOpenAiRealtimeCall({ sdpOffer: 'v=0\\r\\nprivate-offer', session: createRealtimeVoiceSessionConfiguration('nl') })).rejects.toThrowError(expect.objectContaining({ code: 'PROVIDER_FAILED' }))

    expect(errorSpy).toHaveBeenCalledWith('[AI_PROVIDER] GPT-Live session failed', {
      apiFamily: 'live',
      endpoint: 'https://api.openai.com/v1/live/sessions',
      model: 'gpt-live-1',
      status: 422,
      openAiErrorType: 'invalid_request_error',
      openAiErrorCode: 'unknown_parameter',
      openAiErrorParam: 'session.type',
      requestId: 'req_safe',
    })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private-offer')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('unit-test-only')
  })
})
