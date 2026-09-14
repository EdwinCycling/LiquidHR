'use client'

import { useEffect, useId, useReducer, useRef, type ReactElement } from 'react'
import { Mic, MicOff, PhoneOff, AudioLines } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { parseRealtimeVoiceFunctionCall } from '@/lib/ai/realtime-voice-events'
import { employeeLiveVoiceReducer, initialEmployeeLiveVoiceState, type EmployeeLiveVoiceError } from './employee-live-voice-state'
import { recordEmployeeLiveVoiceDiagnostic, safeVoiceErrorMetadata } from './employee-live-voice-diagnostics'

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
  mute: string
  unmute: string
  muted: string
  closing: string
  privacy: string
  employeeContext: string
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
  rtpTimer?: ReturnType<typeof setInterval>
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
  clearInterval(run.rtpTimer)
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

function interruptResponse(run: VoiceRun): void {
  if (run.closed || run.channel?.readyState !== 'open') return
  try {
    sendEvent(run, { type: 'response.cancel' })
    sendEvent(run, { type: 'output_audio_buffer.clear' })
  } catch {
    // The peer error handler presents the generic connection error and performs cleanup.
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
  employeeName,
  locale,
  labels,
  enabled = true,
}: {
  employeeId: string
  employeeName: string
  locale: string
  labels: EmployeeLiveVoiceLabels
  enabled?: boolean
}): ReactElement {
  const headingId = useId()
  const current = useRef<VoiceRun | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [state, dispatch] = useReducer(employeeLiveVoiceReducer, initialEmployeeLiveVoiceState)
  const open = state.phase !== 'idle'
  const status = state.phase === 'error' ? labels[state.message] : state.phase === 'idle' ? null : labels[state.phase]
  const canMute = ['listening', 'processing', 'speaking', 'muted'].includes(state.phase)

  useEffect(() => {
    return () => {
      if (current.current) {
        requestSessionClose(current.current)
        close(current.current)
      }
      current.current = null
      dispatch({ type: 'reset' })
    }
  }, [employeeId, locale, enabled])

  function stop(): void {
    dispatch({ type: 'stop' })
    const run = current.current
    if (run) {
      requestSessionClose(run)
      close(run)
    }
    current.current = null
    dispatch({ type: 'closed' })
  }

  function toggleMute(): void {
    if (!canMute || !current.current?.stream) return
    const unmuting = state.phase === 'muted'
    current.current.stream.getAudioTracks().forEach((track) => { track.enabled = unmuting })
    dispatch({ type: unmuting ? 'unmute' : 'mute' })
  }

  async function start(): Promise<void> {
    if (!enabled || current.current) return
    recordEmployeeLiveVoiceDiagnostic({ event: 'start.click' })
    dispatch({ type: 'start' })
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      recordEmployeeLiveVoiceDiagnostic({ event: 'runtime.unavailable', getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia), peerConnection: typeof RTCPeerConnection !== 'undefined' })
      dispatch({ type: 'error', message: 'connectionFailed' })
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
    const live = (): boolean => current.current === run && !run.closed
    const fail = (message: EmployeeLiveVoiceError): void => {
      if (!live()) return
      recordEmployeeLiveVoiceDiagnostic({ event: 'session.failed', message })
      requestSessionClose(run)
      close(run)
      current.current = null
      dispatch({ type: 'error', message })
    }
    run.timer = setTimeout(() => fail('connectionFailed'), 30_000)

    function playAudio(): void {
      if (!live() || !run.audio?.srcObject) return
      recordEmployeeLiveVoiceDiagnostic({ event: 'audio.play.attempt', readyState: run.audio.readyState, muted: run.audio.muted, autoplay: run.audio.autoplay, volume: run.audio.volume, hasSource: run.audio.srcObject !== null })
      void run.audio.play().then(() => {
        recordEmployeeLiveVoiceDiagnostic({ event: 'audio.play.resolved', readyState: run.audio?.readyState ?? 0, muted: run.audio?.muted ?? false, volume: run.audio?.volume ?? 0 })
      }).catch((error: unknown) => {
        recordEmployeeLiveVoiceDiagnostic({ event: 'audio.play.rejected', ...safeVoiceErrorMetadata(error) })
        // Een bewuste pauze kan een lopende play-aanvraag onderbreken.
        if (error instanceof DOMException && error.name === 'AbortError') return
        fail('connectionFailed')
      })
    }

    async function reportInboundRtp(): Promise<void> {
      if (!live() || !run.peer) return
      let bytesReceived = 0
      let packetsReceived = 0
      for (const receiver of run.peer.getReceivers()) {
        const report = await receiver.getStats().catch(() => null)
        report?.forEach((stat) => {
          const entry = stat as unknown as Record<string, unknown>
          if (entry.type !== 'inbound-rtp' || entry.kind !== 'audio') return
          if (typeof entry.bytesReceived === 'number') bytesReceived += entry.bytesReceived
          if (typeof entry.packetsReceived === 'number') packetsReceived += entry.packetsReceived
        })
      }
      recordEmployeeLiveVoiceDiagnostic({ event: 'rtp.inbound', bytesReceived, packetsReceived })
    }

    async function handleEvent(raw: unknown): Promise<void> {
      if (!live() || typeof raw !== 'string') return
      let event: unknown
      try { event = JSON.parse(raw) as unknown } catch { return }
      if (!record(event)) return
      recordEmployeeLiveVoiceDiagnostic({ event: 'dataChannel.message', type: typeof event.type === 'string' ? event.type : 'unknown' })
      const functionCall = parseRealtimeVoiceFunctionCall(event)
      switch (event.type) {
        case 'session.started':
          clearTimeout(run.timer)
          recordEmployeeLiveVoiceDiagnostic({ event: 'session.started' })
          dispatch({ type: 'session.started' })
          return
        case 'session.closed':
          recordEmployeeLiveVoiceDiagnostic({ event: 'session.closed' })
          run.finalized = true
          close(run)
          current.current = null
          dispatch({ type: 'closed' })
          return
        case 'session.input_transcript.delta':
          recordEmployeeLiveVoiceDiagnostic({ event: 'session.input_transcript.delta' })
          run.audio?.pause()
          dispatch({ type: 'input_transcript.delta' })
          return
        case 'input_audio_buffer.speech_started':
          recordEmployeeLiveVoiceDiagnostic({ event: 'input_audio_buffer.speech_started' })
          interruptResponse(run)
          run.audio?.pause()
          dispatch({ type: 'input_audio.speech_started' })
          return
        case 'session.output_transcript.delta':
          recordEmployeeLiveVoiceDiagnostic({ event: 'session.output_transcript.delta' })
          dispatch({ type: 'output_audio.started' })
          playAudio()
          return
        case 'output_audio_buffer.started':
        case 'response.audio.delta':
        case 'response.output_audio.delta':
          recordEmployeeLiveVoiceDiagnostic({ event: 'output_audio.started' })
          dispatch({ type: 'output_audio.started' })
          playAudio()
          return
        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':
        case 'response.output_audio.done':
        case 'response.done':
          recordEmployeeLiveVoiceDiagnostic({ event: 'output_audio.stopped' })
          dispatch({ type: 'output_audio.stopped' })
          return
        case 'response.created':
          dispatch({ type: 'response.created' })
          return
        case 'error': {
          recordEmployeeLiveVoiceDiagnostic({ event: 'provider.error' })
          const providerError = record(event.error) ? event.error : {}
          const errorText = [providerError.type, providerError.code, providerError.message]
            .filter((value): value is string => typeof value === 'string')
            .join(' ')
            .toLowerCase()
          if (errorText.includes('moderation') || errorText.includes('safety') || errorText.includes('content')) {
            run.audio?.pause()
            dispatch({ type: 'input_audio.speech_started' })
            return
          }
          fail('connectionFailed')
          return
        }
        case 'response.event': {
          const nested = record(event.event) ? event.event : null
          recordEmployeeLiveVoiceDiagnostic({ event: 'response.event', nestedType: typeof nested?.type === 'string' ? nested.type : 'unknown' })
          if (nested?.type === 'response.created') dispatch({ type: 'response.created' })
          if (nested?.type === 'response.completed') dispatch({ type: 'output_audio.stopped' })
          break
        }
        default:
          break
      }
      if (!functionCall || run.calls.has(functionCall.callId)) return
      run.calls.add(functionCall.callId)
      run.toolCallCount += 1
      dispatch({ type: 'tool.started' })
      let output: string
      try {
        const response = await fetch(`${run.base}/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, name: functionCall.name, arguments: functionCall.arguments }),
          signal: run.tools.signal,
        })
        const result: unknown = await response.json()
        const data = record(result) && record(result.data) ? result.data : null
        const proposedText = data && typeof data.proposedText === 'string' ? data.proposedText : null
        const resultText = data && typeof data.resultText === 'string' ? data.resultText : null
        if (!response.ok || (!proposedText && !resultText)) {
          throw new Error('tool_failed')
        }
        if (data && data.created === true && typeof data.reminderId === 'string' && typeof data.title === 'string' && typeof data.remindAt === 'string') {
          output = JSON.stringify({ reminderId: data.reminderId, title: data.title, remindAt: data.remindAt, created: true })
        } else {
          output = proposedText ?? resultText ?? JSON.stringify({ error: 'tool_failed' })
        }
      } catch {
        if (!live()) return
        output = JSON.stringify({ error: 'tool_failed' })
        dispatch({ type: 'tool.failed' })
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
      recordEmployeeLiveVoiceDiagnostic({ event: 'getUserMedia.request', audio: true })
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (error: unknown) {
        recordEmployeeLiveVoiceDiagnostic({ event: 'getUserMedia.rejected', ...safeVoiceErrorMetadata(error) })
        throw error
      }
      if (!live()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      run.stream = stream
      const audioTracks = stream.getAudioTracks()
      recordEmployeeLiveVoiceDiagnostic({ event: 'getUserMedia.resolved', trackCount: stream.getTracks().length, audioTrackCount: audioTracks.length, audioTracksLive: audioTracks.every((track) => track.readyState === 'live') })
      const peer = new RTCPeerConnection()
      run.peer = peer
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.created' })
      const audio = audioRef.current
      if (!audio) throw new Error('audio_unavailable')
      run.audio = audio
      recordEmployeeLiveVoiceDiagnostic({ event: 'audio.element.ready', readyState: audio.readyState, muted: audio.muted, autoplay: audio.autoplay, volume: audio.volume, hasSource: audio.srcObject !== null })
      peer.ontrack = ({ track, streams }) => {
        if (!live()) return
        recordEmployeeLiveVoiceDiagnostic({ event: 'peer.track', kind: track.kind, streamCount: streams.length, trackState: track.readyState })
        audio.srcObject = streams[0] ?? new MediaStream([track])
        recordEmployeeLiveVoiceDiagnostic({ event: 'audio.source.attached', hasSource: audio.srcObject !== null, muted: audio.muted, autoplay: audio.autoplay, volume: audio.volume })
        playAudio()
      }
      peer.onconnectionstatechange = () => {
        recordEmployeeLiveVoiceDiagnostic({ event: 'peer.connectionstatechange', state: peer.connectionState })
        if (['failed', 'closed'].includes(peer.connectionState)) fail('connectionFailed')
      }
      peer.oniceconnectionstatechange = () => recordEmployeeLiveVoiceDiagnostic({ event: 'peer.iceconnectionstatechange', state: peer.iceConnectionState })
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.addTrack', trackCount: audioTracks.length })
      const channel = peer.createDataChannel('oai-events')
      run.channel = channel
      recordEmployeeLiveVoiceDiagnostic({ event: 'dataChannel.created', label: channel.label })
      channel.onopen = () => recordEmployeeLiveVoiceDiagnostic({ event: 'dataChannel.open', readyState: channel.readyState })
      channel.onmessage = (event: MessageEvent<unknown>) => { void handleEvent(event.data) }
      channel.onerror = () => { recordEmployeeLiveVoiceDiagnostic({ event: 'dataChannel.error' }); fail('connectionFailed') }
      channel.onclose = () => { recordEmployeeLiveVoiceDiagnostic({ event: 'dataChannel.close', finalized: run.finalized }); if (!run.finalized) fail('connectionFailed') }
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.createOffer.start' })
      const offer = await peer.createOffer()
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.createOffer.resolved', hasSdp: Boolean(offer.sdp), sdpLength: offer.sdp?.length ?? 0 })
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.setLocalDescription.start', type: offer.type, hasSdp: Boolean(offer.sdp) })
      await peer.setLocalDescription(offer)
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.setLocalDescription.resolved', iceGatheringState: peer.iceGatheringState })
      await waitForIceGathering(peer)
      if (!live()) return
      const sdpOffer = peer.localDescription?.sdp
      if (!sdpOffer) throw new Error('missing_offer')
      recordEmployeeLiveVoiceDiagnostic({ event: 'session.request', sdpLength: sdpOffer.length })
      const response = await fetch(`${run.base}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, sdpOffer }),
      })
      recordEmployeeLiveVoiceDiagnostic({ event: 'session.response', status: response.status, ok: response.ok })
      const result: unknown = await response.json()
      if (record(result) && record(result.data) && typeof result.data.sessionId === 'string') {
        run.sessionId = result.data.sessionId
      }
      if (!live()) { endUsage(run); return }
      if (!response.ok || !run.sessionId || !record(result) || !record(result.data) || typeof result.data.sdpAnswer !== 'string') {
        throw new Error('invalid_session')
      }
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.setRemoteDescription.start', type: 'answer', hasSdp: true, sdpLength: result.data.sdpAnswer.length })
      await peer.setRemoteDescription({ type: 'answer', sdp: result.data.sdpAnswer })
      recordEmployeeLiveVoiceDiagnostic({ event: 'peer.setRemoteDescription.resolved', connectionState: peer.connectionState })
      run.rtpTimer = setInterval(() => { void reportInboundRtp() }, 1_000)
    } catch (error: unknown) {
      recordEmployeeLiveVoiceDiagnostic({ event: 'session.start.rejected', ...safeVoiceErrorMetadata(error) })
      if (error instanceof DOMException && error.name === 'NotAllowedError') recordEmployeeLiveVoiceDiagnostic({ event: 'getUserMedia.rejected', ...safeVoiceErrorMetadata(error) })
      fail(error instanceof DOMException && error.name === 'NotAllowedError' ? 'microphoneDenied' : 'connectionFailed')
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-medium">{labels.title}</h3>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" disabled={!enabled && !open} onClick={open ? stop : () => { void start() }}>
          {open ? labels.stop : labels.start}
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {!enabled ? labels.disabled : status}
        </p>
      </div>
      <audio aria-hidden="true" ref={audioRef} autoPlay playsInline className="sr-only" />
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => { if (!nextOpen) stop() }}
        title={labels.title}
        description={`${labels.employeeContext}: ${employeeName}`}
        closeLabel={labels.stop}
        footer={(
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="secondary" disabled={!canMute} aria-pressed={state.phase === 'muted'} onClick={toggleMute}>
              {state.phase === 'muted' ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {state.phase === 'muted' ? labels.unmute : labels.mute}
            </Button>
            <Button type="button" variant="danger" onClick={stop}>
              <PhoneOff aria-hidden="true" />{labels.stop}
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <div aria-hidden="true" className={`flex size-32 items-center justify-center rounded-full border border-primary/35 bg-accent text-accent-foreground motion-reduce:animate-none ${['connecting', 'processing', 'speaking'].includes(state.phase) ? 'motion-safe:animate-pulse' : ''}`}>
            {state.phase === 'muted' ? <MicOff className="size-12" /> : <AudioLines className="size-12" />}
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className={`text-sm font-medium ${state.phase === 'error' ? 'text-destructive' : 'text-foreground'}`}>
            {status}
          </p>
          <p className="text-sm text-muted-foreground">{labels.privacy}</p>
        </div>
      </Dialog>
    </section>
  )
}
