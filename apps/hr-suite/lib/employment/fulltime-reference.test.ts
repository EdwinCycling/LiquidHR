import { describe, expect, it } from 'vitest'
import { calculateCappedPartTimeFactor, capPartTimeFactor } from './fulltime-reference'

describe('fulltime reference', () => {
  it('berekent de verloffactor op basis van contracturen en de fulltime-norm', () => {
    expect(calculateCappedPartTimeFactor(32, 40)).toBe(0.8)
    expect(calculateCappedPartTimeFactor(40, 40)).toBe(1)
  })

  it('begrensd contracturen boven de fulltime-norm op 100 procent', () => {
    expect(calculateCappedPartTimeFactor(48, 40)).toBe(1)
    expect(capPartTimeFactor(1.25)).toBe(1)
    expect(capPartTimeFactor(-0.25)).toBe(0)
  })

  it('geeft geen factor terug bij een onbruikbare fulltime-norm', () => {
    expect(calculateCappedPartTimeFactor(32, 0)).toBe(0)
    expect(calculateCappedPartTimeFactor(Number.NaN, 40)).toBe(0)
  })
})
