import { describe, expect, it } from 'vitest'
import {
  aggregateTeamProfiles,
  calculateTeamCompassProfile,
  getShiftBand,
  type TeamCompassAnswer,
} from './score-engine'

const dimensions = ['ACTION', 'VISION', 'HARMONY', 'LOGIC'] as const

function answers(innerByDimension: Partial<Record<(typeof dimensions)[number], number>> = {}, outerByDimension: Partial<Record<(typeof dimensions)[number], number>> = {}): TeamCompassAnswer[] {
  return dimensions.flatMap((dimension, dimensionIndex) => Array.from({ length: 10 }, (_unused, questionIndex) => ({
    questionId: `${dimension}-${questionIndex + 1}`,
    dimension,
    sortOrder: dimensionIndex * 10 + questionIndex + 1,
    inner: innerByDimension[dimension] ?? 1,
    outer: outerByDimension[dimension] ?? 1,
  })))
}

describe('calculateTeamCompassProfile', () => {
  it('normaliseert de minimale score en gebruikt een stabiele volgorde bij gelijke dimensies', () => {
    const profile = calculateTeamCompassProfile(answers())

    expect(profile.percentages.inner).toEqual({ ACTION: 0, VISION: 0, HARMONY: 0, LOGIC: 0 })
    expect(profile.coordinates).toEqual({ inner: { x: 0, y: 0 }, outer: { x: 0, y: 0 } })
    expect(profile.shiftDistance).toBe(0)
    expect(profile.primaryDimension).toBe('ACTION')
    expect(profile.secondaryDimension).toBe('VISION')
  })

  it('berekent Inner, Outer en de vectorafstand deterministisch', () => {
    const profile = calculateTeamCompassProfile(answers({ ACTION: 5 }, { LOGIC: 5 }))

    expect(profile.percentages.inner).toEqual({ ACTION: 100, VISION: 0, HARMONY: 0, LOGIC: 0 })
    expect(profile.percentages.outer).toEqual({ ACTION: 0, VISION: 0, HARMONY: 0, LOGIC: 100 })
    expect(profile.coordinates.inner).toEqual({ x: 50, y: 50 })
    expect(profile.coordinates.outer).toEqual({ x: -50, y: 50 })
    expect(profile.shiftDistance).toBe(100)
    expect(profile.shiftBand).toBe('HIGH')
  })

  it('weigert een onvolledige of dubbele vragenlijst', () => {
    expect(() => calculateTeamCompassProfile(answers().slice(0, 39))).toThrow('TEAM_COMPASS_ANSWERS_INCOMPLETE')
    expect(() => calculateTeamCompassProfile([...answers().slice(0, 39), answers()[0]!])).toThrow('TEAM_COMPASS_ANSWERS_DUPLICATE')
  })
})

describe('getShiftBand', () => {
  it('hanteert de vastgestelde grenswaarden', () => {
    expect(getShiftBand(14.99)).toBe('LOW')
    expect(getShiftBand(15)).toBe('MEDIUM')
    expect(getShiftBand(35)).toBe('MEDIUM')
    expect(getShiftBand(35.01)).toBe('HIGH')
  })
})

describe('aggregateTeamProfiles', () => {
  const profile = calculateTeamCompassProfile(answers({ ACTION: 5 }, { ACTION: 4, VISION: 2 }))

  it('geeft onder de anonimiteitsdrempel uitsluitend aantallen vrij', () => {
    expect(aggregateTeamProfiles([profile, profile], 5)).toEqual({ available: false, completedCount: 2, threshold: 5 })
  })

  it('berekent boven de drempel uitsluitend de teamprojectie', () => {
    const aggregate = aggregateTeamProfiles([profile, profile, profile, profile, profile], 5)

    expect(aggregate.available).toBe(true)
    if (!aggregate.available) throw new Error('expected aggregate')
    expect(aggregate.completedCount).toBe(5)
    expect(aggregate.outerPercentages).toEqual(profile.percentages.outer)
    expect(aggregate.dominantDimension).toBe('ACTION')
    expect(aggregate.minorityDimension).toBe('HARMONY')
  })
})
