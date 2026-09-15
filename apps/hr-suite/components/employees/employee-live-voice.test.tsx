// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nl from '@/messages/nl/employees.json'

const { recordEmployeeLiveVoiceDiagnostic } = vi.hoisted(() => ({
  recordEmployeeLiveVoiceDiagnostic: vi.fn(),
}))

vi.mock('./employee-live-voice-diagnostics', () => ({
  recordEmployeeLiveVoiceDiagnostic,
  safeVoiceErrorMetadata: () => ({ errorName: 'Error' }),
}))

import { EmployeeLiveVoice, type EmployeeLiveVoiceLabels } from './employee-live-voice'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: EmployeeLiveVoiceLabels = {
  title: nl.aiVoiceTitle, description: nl.aiVoiceDescription, start: nl.aiVoiceStart,
  stop: nl.aiVoiceStop, connecting: nl.aiVoiceConnecting, listening: nl.aiVoiceListening,
  speaking: nl.aiVoiceSpeaking, processing: nl.aiVoiceProcessing,
  microphoneDenied: nl.aiVoiceMicrophoneDenied, connectionFailed: nl.aiVoiceConnectionFailed,
  disabled: nl.aiVoiceDisabled, toolFailed: nl.aiVoiceToolFailed,
  mute: nl.aiVoiceMute, unmute: nl.aiVoiceUnmute, muted: nl.aiVoiceMuted,
  closing: nl.aiVoiceClosing, privacy: nl.aiVoicePrivacy, employeeContext: nl.aiVoiceEmployeeContext,
  elapsed: nl.aiVoiceElapsed, paused: nl.aiVoicePaused, inputLevel: nl.aiVoiceInputLevel, inputMuted: nl.aiVoiceInputMuted,
}

describe('EmployeeLiveVoice dialog', () => {
  let root: Root
  let container: HTMLDivElement
  const track = { enabled: true, stop: vi.fn() }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  const channel = { readyState: 'open', send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null as null | ((event: { data: string }) => void), onerror: null, onclose: null }
  const receiverTrack = { stop: vi.fn() }
  const peer = {
    iceGatheringState: 'complete', localDescription: { sdp: 'offer' },
    ontrack: null as null | ((event: { track: typeof track; streams: typeof stream[] }) => void),
    onconnectionstatechange: null, getReceivers: () => [{ track: receiverTrack }],
    close: vi.fn(), addTrack: vi.fn(), createDataChannel: () => channel,
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined), setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(async () => {
    recordEmployeeLiveVoiceDiagnostic.mockReset()
    track.enabled = true
    vi.stubGlobal('RTCPeerConnection', class { constructor() { return peer } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { sessionId: 'test-session', sdpAnswer: 'answer' } }) }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const sources = new WeakMap<HTMLMediaElement, HTMLMediaElement['srcObject']>()
    vi.spyOn(HTMLMediaElement.prototype, 'srcObject', 'set').mockImplementation(function (this: HTMLMediaElement, value) { sources.set(this, value) })
    vi.spyOn(HTMLMediaElement.prototype, 'srcObject', 'get').mockImplementation(function (this: HTMLMediaElement) { return sources.get(this) ?? null })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<EmployeeLiveVoice employeeId="employee-test" employeeName="Test Medewerker" locale="nl" labels={labels} />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function start(): Promise<HTMLButtonElement> {
    const trigger = container.querySelector('button')!
    trigger.focus()
    await act(async () => trigger.click())
    return trigger
  }

  async function event(type: string): Promise<void> {
    await act(async () => channel.onmessage?.({ data: JSON.stringify({ type }) }))
  }

  it('shows context and privacy, plays DOM audio and mutes through the shared state', async () => {
    await start()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Test Medewerker')
    expect(dialog.textContent).toContain('AI luistert alleen tijdens dit gesprek. Audio wordt niet opgeslagen.')
    const audio = container.querySelector('audio')!
    expect(audio.hasAttribute('autoplay')).toBe(true)
    expect(audio.hasAttribute('playsinline')).toBe(true)
    await act(async () => peer.ontrack?.({ track, streams: [stream] }))
    expect(audio.srcObject).toBe(stream)
    expect(audio.play).toHaveBeenCalled()
    await event('session.started')
    const mute = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === labels.mute)!
    await act(async () => mute.click())
    expect(track.enabled).toBe(false)
    expect(mute.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain(labels.muted)
    await act(async () => mute.click())
    expect(track.enabled).toBe(true)
    expect(container.textContent).toContain(labels.listening)
  })

  it.each(['escape', 'backdrop', 'close', 'end'] as const)('cleans up and restores focus on %s', async (method) => {
    const trigger = await start()
    const dialog = document.querySelector('[role="dialog"]')!
    await act(async () => {
      if (method === 'escape') dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      else if (method === 'backdrop') dialog.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      else if (method === 'close') dialog.querySelector('button')!.click()
      else dialog.querySelector('footer button:last-child')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('session.close'))
    expect(track.stop).toHaveBeenCalled()
    expect(receiverTrack.stop).toHaveBeenCalled()
    expect(channel.close).toHaveBeenCalled()
    expect(peer.close).toHaveBeenCalled()
    expect(container.querySelector('audio')!.srcObject).toBeNull()
    expect(fetch).toHaveBeenCalledWith('/api/employees/employee-test/ai/voice/usage', expect.objectContaining({ keepalive: true }))
  })

  it('stops a microphone that resolves after closing during connection', async () => {
    let resolveStream!: (value: MediaStream) => void
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise((resolve) => { resolveStream = resolve }))
    await start()
    await act(async () => document.querySelector('[role="dialog"] button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await act(async () => resolveStream(stream as unknown as MediaStream))
    expect(track.stop).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('pauses local output when the user interrupts spoken output without sending Realtime-only commands', async () => {
    await start()
    await event('session.started')
    await event('output_audio_buffer.started')
    await event('input_audio_buffer.speech_started')

    expect(document.querySelector('audio')?.pause).toHaveBeenCalled()
    expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining('"type":"response.cancel"'))
    expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining('"type":"output_audio_buffer.clear"'))
    expect(container.textContent).toContain(labels.listening)
  })

  it('closes transport and usage on unmount', async () => {
    await start()
    await act(async () => root.render(null))
    expect(track.stop).toHaveBeenCalled()
    expect(channel.close).toHaveBeenCalled()
    expect(peer.close).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('/api/employees/employee-test/ai/voice/usage', expect.objectContaining({ keepalive: true }))
  })

  it('aborts pending tool requests when ending the conversation', async () => {
    await start()
    await event('session.started')
    let toolSignal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/tool')) {
        toolSignal = init?.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          toolSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
      }
      return new Response('{}')
    })
    await act(async () => channel.onmessage?.({ data: JSON.stringify({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'call-test', name: 'employee_summary', arguments: '{}' } } }) }))
    expect(toolSignal?.aborted).toBe(false)
    await act(async () => document.querySelector('[role="dialog"] button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(toolSignal?.aborted).toBe(true)
  })

  it('shows a translated microphone error inside the dialog', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await start()
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(labels.microphoneDenied)
  })

  it('records only safe provider error metadata before closing a failed session', async () => {
    await start()
    await act(async () => channel.onmessage?.({ data: JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', code: 'invalid_event', message: 'must not be logged' },
    }) }))

    expect(recordEmployeeLiveVoiceDiagnostic).toHaveBeenCalledWith({
      event: 'provider.error',
      providerErrorCode: 'invalid_event',
      providerErrorType: 'invalid_request_error',
    })
  })
})
