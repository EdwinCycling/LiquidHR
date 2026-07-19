import { describe, expect, it } from 'vitest'
import { clampHeRaWidth, parseHeRaDockState } from './hera-floating-state'

describe('HeRa floating state', () => {
  it('clamps the saved width to a usable range', () => {
    expect(clampHeRaWidth(260)).toBe(320)
    expect(clampHeRaWidth(900)).toBe(760)
    expect(clampHeRaWidth(540)).toBe(540)
  })

  it('falls back to overlay for invalid saved docking state', () => {
    expect(parseHeRaDockState('invalid')).toBe('overlay')
    expect(parseHeRaDockState('docked')).toBe('docked')
  })
})
