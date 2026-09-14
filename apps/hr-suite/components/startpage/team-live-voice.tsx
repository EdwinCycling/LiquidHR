'use client'

import { useEffect, useId, useReducer, useRef, useState, type ReactElement } from 'react'
import { AudioLines, Mic, MicOff, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { parseTeamRealtimeVoiceFunctionCall } from '@/lib/ai/realtime-voice-events'
import { employeeLiveVoiceReducer, initialEmployeeLiveVoiceState, type EmployeeLiveVoiceError } from '@/components/employees/employee-live-voice-state'

export type TeamLiveVoiceLabels = {
  title: string
  description: string
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
  mute: string
  unmute: string
  muted: string
  closing: string
  privacy: string
  scope: string
  summaryTitle: string
  summaryDescription: string
  summaryDefaultTitle: string
  summaryTitleLabel: string
  summaryBodyLabel: string
  summarySave: string
  summarySaving: string
  summarySaved: string
  summaryFailed: string
  close: string
}

type TeamVoiceRun = {
  base: string
  departmentId?: string
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
  rtpTimer?: ReturnType<typeof setInterval>
  eventSequence: number
  closing: boolean
  finalized: boolean
  tools: AbortController
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function endUsage(run: TeamVoiceRun): void {
  if (!run.sessionId || run.usageSent) return
  run.usageSent = true
  void fetch(`${run.base}/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: run.sessionId, toolCallCount: run.toolCallCount }),
    keepalive: true,
  }).catch(() => undefined)
}

function close(run: TeamVoiceRun): void {
  run.closed = true
  clearTimeout(run.timer)
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

function sendSessionClose(run: TeamVoiceRun): void {
  if (run.channel?.readyState !== 'open') return
  run.eventSequence += 1
  run.channel.send(JSON.stringify({ event_id: `liquidhr-team-live-${run.eventSequence}`, type: 'session.close' }))
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
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

export function TeamLiveVoice({ departmentId, contextName, enabled = true, labels, locale }: { departmentId?: string; contextName: string; enabled?: boolean; labels: TeamLiveVoiceLabels; locale: string }): ReactElement {
  const headingId = useId()
  const audioRef = useRef<HTMLAudioElement>(null)
  const current = useRef<TeamVoiceRun | null>(null)
  const [state, dispatch] = useReducer(employeeLiveVoiceReducer, initialEmployeeLiveVoiceState)
  const [proposal, setProposal] = useState<{ sessionId: string; text: string } | null>(null)
  const [summaryTitle, setSummaryTitle] = useState(labels.summaryDefaultTitle)
  const [summaryBody, setSummaryBody] = useState('')
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const open = state.phase !== 'idle'
  const status = state.phase === 'error' ? labels[state.message] : state.phase === 'idle' ? null : labels[state.phase]
  const canMute = ['listening', 'processing', 'speaking', 'muted'].includes(state.phase)

  useEffect(() => {
    return () => {
      if (current.current) {
        try {
          sendSessionClose(current.current)
        } catch {
          // Closing the browser transport is best effort during unmount.
        }
        close(current.current)
      }
      current.current = null
      dispatch({ type: 'reset' })
    }
  }, [departmentId, locale, enabled])

  function stop(): void {
    dispatch({ type: 'stop' })
    const run = current.current
    if (run) {
      try {
        sendSessionClose(run)
      } catch {
        // The normal close path still records usage and releases media.
      }
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

  async function saveSummary(): Promise<void> {
    if (!proposal || !summaryTitle.trim() || !summaryBody.trim()) return
    setSummaryStatus('saving')
    const response = await fetch('/api/logbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: proposal.sessionId, title: summaryTitle.trim(), description: summaryBody.trim() }),
    }).catch(() => null)
    if (response?.ok) setSummaryStatus('saved')
    else setSummaryStatus('failed')
  }

  async function start(): Promise<void> {
    if (!enabled || current.current) return
    dispatch({ type: 'start' })
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      dispatch({ type: 'error', message: 'connectionFailed' })
      return
    }
    const run: TeamVoiceRun = { base: '/api/team-ai/voice', departmentId, closed: false, usageSent: false, toolCallCount: 0, calls: new Set(), eventSequence: 0, closing: false, finalized: false, tools: new AbortController() }
    current.current = run
    const live = (): boolean => current.current === run && !run.closed
    const fail = (message: EmployeeLiveVoiceError): void => {
      if (!live()) return
      requestSessionClose()
      close(run)
      current.current = null
      dispatch({ type: 'error', message })
    }
    run.timer = setTimeout(() => fail('connectionFailed'), 30_000)

    function nextEventId(): string {
      run.eventSequence += 1
      return `liquidhr-team-live-${run.eventSequence}`
    }
    function send(event: Record<string, unknown>): void {
      if (run.channel?.readyState !== 'open') throw new Error('channel_not_open')
      run.channel.send(JSON.stringify({ event_id: nextEventId(), ...event }))
    }
    function requestSessionClose(): void {
      if (!live() || run.closing || run.channel?.readyState !== 'open') return
      run.closing = true
      try { send({ type: 'session.close' }) } catch { /* best effort */ }
    }
    function interrupt(): void {
      if (!live() || run.channel?.readyState !== 'open') return
      try {
        send({ type: 'response.cancel' })
        send({ type: 'output_audio_buffer.clear' })
      } catch { /* transport failure is handled by the peer */ }
    }
    function playAudio(): void {
      if (!live() || !run.audio?.srcObject) return
      void run.audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        fail('connectionFailed')
      })
    }

    async function handleEvent(raw: unknown): Promise<void> {
      if (!live() || typeof raw !== 'string') return
      let event: unknown
      try { event = JSON.parse(raw) as unknown } catch { return }
      if (!isRecord(event)) return
      const functionCall = parseTeamRealtimeVoiceFunctionCall(event)
      switch (event.type) {
        case 'session.started':
          clearTimeout(run.timer)
          dispatch({ type: 'session.started' })
          return
        case 'session.closed':
          run.finalized = true
          close(run)
          current.current = null
          dispatch({ type: 'closed' })
          return
        case 'input_audio_buffer.speech_started':
          interrupt()
          run.audio?.pause()
          dispatch({ type: 'input_audio.speech_started' })
          return
        case 'session.input_transcript.delta':
          run.audio?.pause()
          dispatch({ type: 'input_transcript.delta' })
          return
        case 'response.created':
          dispatch({ type: 'response.created' })
          return
        case 'session.output_transcript.delta':
        case 'output_audio_buffer.started':
        case 'response.audio.delta':
        case 'response.output_audio.delta':
          dispatch({ type: 'output_audio.started' })
          playAudio()
          return
        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':
        case 'response.output_audio.done':
        case 'response.done':
          dispatch({ type: 'output_audio.stopped' })
          return
        case 'error':
          fail('connectionFailed')
          return
        case 'response.event': {
          const nested = isRecord(event.event) ? event.event : null
          if (nested?.type === 'response.created') dispatch({ type: 'response.created' })
          if (nested?.type === 'response.completed') dispatch({ type: 'output_audio.stopped' })
          break
        }
        default:
          break
      }
      if (!functionCall || run.calls.has(functionCall.callId) || !run.sessionId) return
      run.calls.add(functionCall.callId)
      run.toolCallCount += 1
      dispatch({ type: 'tool.started' })
      let output: string
      try {
        const response = await fetch(`${run.base}/tool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: run.sessionId, locale, name: functionCall.name, arguments: functionCall.arguments }), signal: run.tools.signal })
        const result: unknown = await response.json()
        const data = isRecord(result) && isRecord(result.data) ? result.data : null
        const resultText = data && typeof data.resultText === 'string' ? data.resultText : null
        if (!response.ok || !resultText) throw new Error('tool_failed')
        if (data && data.created === true && typeof data.reminderId === 'string' && typeof data.title === 'string' && typeof data.remindAt === 'string') {
          output = JSON.stringify({ reminderId: data.reminderId, title: data.title, remindAt: data.remindAt, created: true })
        } else {
          output = resultText
        }
        if (data && typeof data.proposedText === 'string') {
          setProposal({ sessionId: run.sessionId, text: data.proposedText })
          setSummaryBody(data.proposedText)
          setSummaryTitle(labels.summaryDefaultTitle)
          setSummaryStatus('idle')
        }
      } catch {
        if (!live()) return
        output = JSON.stringify({ error: 'tool_failed' })
        dispatch({ type: 'tool.failed' })
      }
      if (!live() || run.channel?.readyState !== 'open') return
      try {
        send({ type: 'response.item.create', item: { type: 'function_call_output', call_id: functionCall.callId, output } })
        send({ type: 'response.create' })
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
      const audio = audioRef.current
      if (!audio) throw new Error('audio_unavailable')
      run.audio = audio
      peer.ontrack = ({ track, streams }) => {
        if (!live()) return
        audio.srcObject = streams[0] ?? new MediaStream([track])
        playAudio()
      }
      peer.onconnectionstatechange = () => { if (['failed', 'closed'].includes(peer.connectionState)) fail('connectionFailed') }
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      const channel = peer.createDataChannel('oai-events')
      run.channel = channel
      channel.onmessage = (event) => { void handleEvent(event.data) }
      channel.onerror = () => fail('connectionFailed')
      channel.onclose = () => { if (!run.finalized) fail('connectionFailed') }
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await waitForIceGathering(peer)
      if (!live()) return
      const sdpOffer = peer.localDescription?.sdp
      if (!sdpOffer) throw new Error('missing_offer')
      const response = await fetch(`${run.base}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, departmentId, sdpOffer }) })
      const result: unknown = await response.json()
      if (isRecord(result) && isRecord(result.data) && typeof result.data.sessionId === 'string') run.sessionId = result.data.sessionId
      if (!response.ok || !run.sessionId || !isRecord(result) || !isRecord(result.data) || typeof result.data.sdpAnswer !== 'string') throw new Error('invalid_session')
      await peer.setRemoteDescription({ type: 'answer', sdp: result.data.sdpAnswer })
    } catch (error: unknown) {
      fail(error instanceof DOMException && error.name === 'NotAllowedError' ? 'microphoneDenied' : 'connectionFailed')
    }
  }

  return <section aria-labelledby={headingId} className="flex flex-col gap-3">
    <h3 className="text-sm font-medium" id={headingId}>{labels.title}</h3>
    <p className="text-sm text-muted-foreground">{labels.description}</p>
    <p className="text-xs text-muted-foreground">{labels.scope}: {contextName}</p>
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" disabled={!enabled && !open} onClick={open ? stop : () => { void start() }}>{open ? labels.stop : labels.start}</Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">{!enabled ? labels.disabled : status}</p>
    </div>
    <audio aria-hidden="true" autoPlay playsInline ref={audioRef} className="sr-only" />
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) stop() }} title={labels.title} description={`${labels.scope}: ${contextName}`} closeLabel={labels.close} footer={<div className="flex flex-wrap justify-center gap-3"><Button type="button" variant="secondary" disabled={!canMute} aria-pressed={state.phase === 'muted'} onClick={toggleMute}>{state.phase === 'muted' ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}{state.phase === 'muted' ? labels.unmute : labels.mute}</Button><Button type="button" variant="danger" onClick={stop}><PhoneOff aria-hidden="true" />{labels.stop}</Button></div>}>
      <div className="flex flex-col items-center gap-6 py-4 text-center"><div aria-hidden="true" className={`flex size-32 items-center justify-center rounded-full border border-primary/35 bg-accent text-accent-foreground motion-reduce:animate-none ${['connecting', 'processing', 'speaking'].includes(state.phase) ? 'motion-safe:animate-pulse' : ''}`}>{state.phase === 'muted' ? <MicOff className="size-12" /> : <AudioLines className="size-12" />}</div><p aria-atomic="true" aria-live="polite" className={`text-sm font-medium ${state.phase === 'error' ? 'text-destructive' : 'text-foreground'}`}>{status}</p><p className="text-sm text-muted-foreground">{labels.privacy}</p></div>
    </Dialog>
    {proposal ? <section aria-label={labels.summaryTitle} className="mt-3 rounded-[var(--radius-control)] border bg-surface-subtle p-4"><h4 className="font-semibold">{labels.summaryTitle}</h4><p className="mt-1 text-sm text-muted-foreground">{labels.summaryDescription}</p><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-medium">{labels.summaryTitleLabel}<TextInput value={summaryTitle} onChange={(event) => setSummaryTitle(event.target.value)} /></label><label className="grid gap-1 text-sm font-medium">{labels.summaryBodyLabel}<Textarea value={summaryBody} onChange={(event) => setSummaryBody(event.target.value)} /></label><div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={summaryStatus === 'saving' || summaryStatus === 'saved' || !summaryTitle.trim() || !summaryBody.trim()} onClick={() => { void saveSummary() }}>{summaryStatus === 'saving' ? labels.summarySaving : summaryStatus === 'saved' ? labels.summarySaved : labels.summarySave}</Button>{summaryStatus === 'failed' ? <span className="text-sm text-destructive" role="alert">{labels.summaryFailed}</span> : null}</div></div></section> : null}
  </section>
}
