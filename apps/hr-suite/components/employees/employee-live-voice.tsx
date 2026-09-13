'use client'

import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { parseRealtimeVoiceFunctionCall } from '@/lib/ai/realtime-voice-events'

export type EmployeeLiveVoiceLabels = {
  start: string
  stop: string
  connecting: string
  listening: string
  speaking: string
  processing: string
  microphoneDenied: string
  connectionFailed: string
  disabled: string
  toolFailed: string
  title: string
  description: string
}

type VoiceRun = {
  base: string
  closed: boolean
  usageSent: boolean
  sessionId?: string
  toolCallCount: number
  calls: Set<string>
  stream?: MediaStream
  peer?: RTCPeerConnection
  channel?: RTCDataChannel
  audio?: HTMLAudioElement
  timer?: ReturnType<typeof setTimeout>
  closeTimer?: ReturnType<typeof setTimeout>
  eventSequence: number
  closing: boolean
  finalized: boolean
  tools: AbortController
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function endUsage(run: VoiceRun): void {
  if (!run.sessionId || run.usageSent) return
  run.usageSent = true
  void fetch(`${run.base}/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: run.sessionId, toolCallCount: run.toolCallCount }),
    keepalive: true,
  }).catch(() => undefined)
}

function close(run: VoiceRun): void {
  run.closed = true
  clearTimeout(run.timer)
  clearTimeout(run.closeTimer)
  run.tools.abort()
  if (run.channel) {
    run.channel.onopen = null
    run.channel.onmessage = null
    run.channel.onerror = null
    run.channel.onclose = null
    run.channel.close()
  }
  if (run.peer) {
    run.peer.ontrack = null
    run.peer.onconnectionstatechange = null
    run.peer.getReceivers().forEach(({ track }) => track?.stop())
    run.peer.close()
  }
  run.stream?.getTracks().forEach((track) => track.stop())
  if (run.audio) {
    run.audio.pause()
    run.audio.srcObject = null
    run.audio.remove()
  }
  endUsage(run)
}

function nextEventId(run: VoiceRun): string {
  run.eventSequence += 1
  return `liquidhr-live-${run.eventSequence}`
}

function sendEvent(run: VoiceRun, event: Record<string, unknown>): void {
  if (run.channel?.readyState !== 'open') throw new Error('channel_not_open')
  run.channel.send(JSON.stringify({ event_id: nextEventId(run), ...event }))
}

function requestSessionClose(run: VoiceRun): boolean {
  if (run.closed || run.closing || run.channel?.readyState !== 'open') return false
  try {
    run.closing = true
    sendEvent(run, { type: 'session.close' })
    return true
  } catch {
    return false
  }
}

async function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onState)
      reject(new Error('ice_timeout'))
    }, 10_000)
    function onState(): void {
      if (peer.iceGatheringState !== 'complete') return
      clearTimeout(timeout)
      peer.removeEventListener('icegatheringstatechange', onState)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', onState)
    onState()
  })
}

export function EmployeeLiveVoice({
  employeeId,
  locale,
  labels,
  enabled = true,
}: {
  employeeId: string
  locale: string
  labels: EmployeeLiveVoiceLabels
  enabled?: boolean
}): ReactElement {
  const headingId = useId()
  const current = useRef<VoiceRun | null>(null)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<keyof EmployeeLiveVoiceLabels | null>(null)

  useEffect(() => {
    return () => {
      if (current.current) close(current.current)
      current.current = null
    }
  }, [employeeId, locale, enabled])

  function stop(): void {
    const run = current.current
    if (run && requestSessionClose(run)) {
      clearTimeout(run.timer)
      run.closeTimer = setTimeout(() => {
        if (current.current !== run) return
        close(run)
        current.current = null
        setActive(false)
        setStatus(null)
      }, 15_000)
      setStatus('processing')
      return
    }
    if (run) close(run)
    current.current = null
    setActive(false)
    setStatus(null)
  }

  async function start(): Promise<void> {
    if (!enabled || current.current) return
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setStatus('connectionFailed')
      return
    }
    const run: VoiceRun = {
      base: `/api/employees/${encodeURIComponent(employeeId)}/ai/voice`,
      closed: false,
      usageSent: false,
      toolCallCount: 0,
      calls: new Set(),
      eventSequence: 0,
      closing: false,
      finalized: false,
      tools: new AbortController(),
    }
    current.current = run
    setActive(true)
    setStatus('connecting')
    const live = (): boolean => current.current === run && !run.closed
    const fail = (message: keyof EmployeeLiveVoiceLabels): void => {
      if (!live()) return
      close(run)
      current.current = null
      setActive(false)
      setStatus(message)
    }
    run.timer = setTimeout(() => fail('connectionFailed'), 30_000)

    async function handleEvent(raw: unknown): Promise<void> {
      if (!live() || typeof raw !== 'string') return
      let event: unknown
      try { event = JSON.parse(raw) as unknown } catch { return }
      if (!record(event)) return
      const functionCall = parseRealtimeVoiceFunctionCall(event)
      switch (event.type) {
        case 'session.started':
          clearTimeout(run.timer)
          setStatus('listening')
          return
        case 'session.closed':
          run.finalized = true
          close(run)
          current.current = null
          setActive(false)
          setStatus(null)
          return
        case 'session.input_transcript.delta':
          run.audio?.pause()
          setStatus('listening')
          return
        case 'session.output_transcript.delta':
          setStatus('speaking')
          return
        case 'error': {
          const providerError = record(event.error) ? event.error : {}
          const errorText = [providerError.type, providerError.code, providerError.message]
            .filter((value): value is string => typeof value === 'string')
            .join(' ')
            .toLowerCase()
          if (errorText.includes('moderation') || errorText.includes('safety') || errorText.includes('content')) {
            run.audio?.pause()
            setStatus('listening')
            return
          }
          fail('connectionFailed')
          return
        }
        case 'response.event': {
          const nested = record(event.event) ? event.event : null
          if (nested?.type === 'response.created') setStatus('processing')
          if (nested?.type === 'response.completed') setStatus('listening')
          break
        }
        default:
          break
      }
      if (!functionCall || run.calls.has(functionCall.callId)) return
      run.calls.add(functionCall.callId)
      run.toolCallCount += 1
      setStatus('processing')
      let output: string
      try {
        const response = await fetch(`${run.base}/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, name: functionCall.name, arguments: functionCall.arguments }),
          signal: run.tools.signal,
        })
        const result: unknown = await response.json()
        if (!response.ok || !record(result) || !record(result.data) || typeof result.data.proposedText !== 'string') {
          throw new Error('tool_failed')
        }
        output = result.data.proposedText
      } catch {
        if (!live()) return
        output = JSON.stringify({ error: 'tool_failed' })
        setStatus('toolFailed')
      }
      if (!live() || run.channel?.readyState !== 'open') return
      try {
        sendEvent(run, {
          type: 'response.item.create',
          item: { type: 'function_call_output', call_id: functionCall.callId, output },
        })
        sendEvent(run, { type: 'response.create' })
      } catch { fail('connectionFailed') }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!live()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      run.stream = stream
      const peer = new RTCPeerConnection()
      run.peer = peer
      const audio = new Audio()
      audio.autoplay = true
      run.audio = audio
      peer.ontrack = ({ track, streams }) => {
        if (!live()) return
        audio.srcObject = streams[0] ?? new MediaStream([track])
        void audio.play().catch(() => fail('connectionFailed'))
      }
      peer.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(peer.connectionState)) fail('connectionFailed')
      }
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      const channel = peer.createDataChannel('oai-events')
      run.channel = channel
      channel.onopen = () => undefined
      channel.onmessage = (event: MessageEvent<unknown>) => { void handleEvent(event.data) }
      channel.onerror = () => fail('connectionFailed')
      channel.onclose = () => { if (!run.finalized) fail('connectionFailed') }
      await peer.setLocalDescription(await peer.createOffer())
      await waitForIceGathering(peer)
      if (!live()) return
      const sdpOffer = peer.localDescription?.sdp
      if (!sdpOffer) throw new Error('missing_offer')
      const response = await fetch(`${run.base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, sdpOffer }),
      })
      const result: unknown = await response.json()
      if (record(result) && record(result.data) && typeof result.data.sessionId === 'string') {
        run.sessionId = result.data.sessionId
      }
      if (!live()) { endUsage(run); return }
      if (!response.ok || !run.sessionId || !record(result) || !record(result.data) || typeof result.data.sdpAnswer !== 'string') {
        throw new Error('invalid_session')
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: result.data.sdpAnswer })
    } catch (error: unknown) {
      fail(error instanceof DOMException && error.name === 'NotAllowedError' ? 'microphoneDenied' : 'connectionFailed')
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-medium">{labels.title}</h3>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" disabled={!enabled && !active} onClick={active ? stop : () => { void start() }}>
          {active ? labels.stop : labels.start}
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {!enabled ? labels.disabled : status ? labels[status] : null}
        </p>
      </div>
    </section>
  )
}
