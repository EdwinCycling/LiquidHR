import { describe, expect, it, vi } from 'vitest'

import { calculateAudioInputLevel, formatElapsed, pauseLiveOutput } from './team-live-voice'

describe('Team AI microphone meter', () => {
  it('derives a bounded local level from microphone waveform samples', () => {
    expect(calculateAudioInputLevel(new Uint8Array([128, 128, 128]))).toBe(0)
    expect(calculateAudioInputLevel(new Uint8Array([0, 255, 0, 255]))).toBeGreaterThan(0.9)
    expect(calculateAudioInputLevel(new Uint8Array())).toBe(0)
  })

  it('formats a stable elapsed conversation timer', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(65.8)).toBe('01:05')
    expect(formatElapsed(-1)).toBe('00:00')
  })

  it('pauses local output for Live barge-in without sending legacy Realtime events', () => {
    const pause = vi.fn()

    pauseLiveOutput({ pause }, true)
    pauseLiveOutput({ pause }, false)

    expect(pause).toHaveBeenCalledTimes(1)
  })
})
