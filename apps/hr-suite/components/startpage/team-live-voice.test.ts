import { describe, expect, it } from 'vitest'

import { calculateAudioInputLevel } from './team-live-voice'

describe('Team AI microphone meter', () => {
  it('derives a bounded local level from microphone waveform samples', () => {
    expect(calculateAudioInputLevel(new Uint8Array([128, 128, 128]))).toBe(0)
    expect(calculateAudioInputLevel(new Uint8Array([0, 255, 0, 255]))).toBeGreaterThan(0.9)
    expect(calculateAudioInputLevel(new Uint8Array())).toBe(0)
  })
})
