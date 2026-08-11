export const TEAM_COMPASS_DIMENSIONS = ['ACTION', 'VISION', 'HARMONY', 'LOGIC'] as const

export type TeamCompassDimension = (typeof TEAM_COMPASS_DIMENSIONS)[number]
export type TeamCompassLayer = 'inner' | 'outer'
export type TeamCompassShiftBand = 'LOW' | 'MEDIUM' | 'HIGH'

export type TeamCompassAnswer = {
  questionId: string
  dimension: TeamCompassDimension
  sortOrder: number
  inner: number
  outer: number
}

export type TeamCompassPercentages = Record<TeamCompassDimension, number>
export type TeamCompassCoordinates = { x: number; y: number }

export type TeamCompassProfile = {
  percentages: Record<TeamCompassLayer, TeamCompassPercentages>
  coordinates: Record<TeamCompassLayer, TeamCompassCoordinates>
  shiftDistance: number
  shiftBand: TeamCompassShiftBand
  primaryDimension: TeamCompassDimension
  secondaryDimension: TeamCompassDimension
}

export type TeamCompassTeamAggregate =
  | { available: false; completedCount: number; threshold: number }
  | {
      available: true
      completedCount: number
      threshold: number
      outerPercentages: TeamCompassPercentages
      dominantDimension: TeamCompassDimension
      minorityDimension: TeamCompassDimension
      balance: 'BALANCED' | 'FOCUSED' | 'MIXED'
    }

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function assertAnswers(answers: readonly TeamCompassAnswer[]): void {
  if (answers.length !== 40) throw new Error('TEAM_COMPASS_ANSWERS_INCOMPLETE')
  const questionIds = new Set(answers.map((answer) => answer.questionId))
  const sortOrders = new Set(answers.map((answer) => answer.sortOrder))
  if (questionIds.size !== 40 || sortOrders.size !== 40) throw new Error('TEAM_COMPASS_ANSWERS_DUPLICATE')

  for (const dimension of TEAM_COMPASS_DIMENSIONS) {
    if (answers.filter((answer) => answer.dimension === dimension).length !== 10) {
      throw new Error('TEAM_COMPASS_DIMENSION_INCOMPLETE')
    }
  }
  for (const answer of answers) {
    if (!Number.isInteger(answer.inner) || !Number.isInteger(answer.outer) || answer.inner < 1 || answer.inner > 5 || answer.outer < 1 || answer.outer > 5) {
      throw new Error('TEAM_COMPASS_SCORE_INVALID')
    }
  }
}

function percentagesFor(answers: readonly TeamCompassAnswer[], layer: TeamCompassLayer): TeamCompassPercentages {
  return Object.fromEntries(TEAM_COMPASS_DIMENSIONS.map((dimension) => {
    const sum = answers.filter((answer) => answer.dimension === dimension).reduce((total, answer) => total + answer[layer], 0)
    return [dimension, round(((sum - 10) / 40) * 100)]
  })) as TeamCompassPercentages
}

function coordinatesFor(percentages: TeamCompassPercentages): TeamCompassCoordinates {
  return {
    x: round(((percentages.ACTION + percentages.VISION) - (percentages.LOGIC + percentages.HARMONY)) / 2),
    y: round(((percentages.ACTION + percentages.LOGIC) - (percentages.VISION + percentages.HARMONY)) / 2),
  }
}

function rankedDimensions(percentages: TeamCompassPercentages, direction: 'asc' | 'desc'): TeamCompassDimension[] {
  return [...TEAM_COMPASS_DIMENSIONS].sort((left, right) => {
    const difference = percentages[left] - percentages[right]
    return direction === 'asc' ? difference : -difference
  })
}

export function getShiftBand(distance: number): TeamCompassShiftBand {
  if (distance < 15) return 'LOW'
  if (distance <= 35) return 'MEDIUM'
  return 'HIGH'
}

export function calculateTeamCompassProfile(answers: readonly TeamCompassAnswer[]): TeamCompassProfile {
  assertAnswers(answers)
  const inner = percentagesFor(answers, 'inner')
  const outer = percentagesFor(answers, 'outer')
  const innerCoordinates = coordinatesFor(inner)
  const outerCoordinates = coordinatesFor(outer)
  const shiftDistance = round(Math.hypot(outerCoordinates.x - innerCoordinates.x, outerCoordinates.y - innerCoordinates.y))
  const ranking = rankedDimensions(inner, 'desc')

  return {
    percentages: { inner, outer },
    coordinates: { inner: innerCoordinates, outer: outerCoordinates },
    shiftDistance,
    shiftBand: getShiftBand(shiftDistance),
    primaryDimension: ranking[0]!,
    secondaryDimension: ranking[1]!,
  }
}

export function aggregateTeamProfiles(profiles: readonly TeamCompassProfile[], threshold: number): TeamCompassTeamAggregate {
  const safeThreshold = Math.max(5, Math.floor(threshold))
  if (profiles.length < safeThreshold) return { available: false, completedCount: profiles.length, threshold: safeThreshold }

  const outerPercentages = Object.fromEntries(TEAM_COMPASS_DIMENSIONS.map((dimension) => [
    dimension,
    round(profiles.reduce((total, profile) => total + profile.percentages.outer[dimension], 0) / profiles.length),
  ])) as TeamCompassPercentages
  const dominantDimension = rankedDimensions(outerPercentages, 'desc')[0]!
  const minorityDimension = rankedDimensions(outerPercentages, 'asc')[0]!
  const values = Object.values(outerPercentages)
  const balanced = values.every((value) => value >= 20 && value <= 30)
  const focused = Math.max(...values) > 35

  return {
    available: true,
    completedCount: profiles.length,
    threshold: safeThreshold,
    outerPercentages,
    dominantDimension,
    minorityDimension,
    balance: balanced ? 'BALANCED' : focused ? 'FOCUSED' : 'MIXED',
  }
}
