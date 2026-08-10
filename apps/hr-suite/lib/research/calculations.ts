export interface EnpsResult {
  score: number | null
  total: number
  promoters: number
  passives: number
  detractors: number
  promoterPercentage: number
  passivePercentage: number
  detractorPercentage: number
}

export function calculateEnps(scores: readonly number[]): EnpsResult {
  const validScores = scores.filter((score) => Number.isInteger(score) && score >= 0 && score <= 10)
  const total = validScores.length
  const promoters = validScores.filter((score) => score >= 9).length
  const passives = validScores.filter((score) => score >= 7 && score <= 8).length
  const detractors = validScores.filter((score) => score <= 6).length

  if (total === 0) {
    return {
      score: null,
      total,
      promoters,
      passives,
      detractors,
      promoterPercentage: 0,
      passivePercentage: 0,
      detractorPercentage: 0,
    }
  }

  return {
    score: Math.round(((promoters - detractors) / total) * 100),
    total,
    promoters,
    passives,
    detractors,
    promoterPercentage: Math.round((promoters / total) * 100),
    passivePercentage: Math.round((passives / total) * 100),
    detractorPercentage: Math.round((detractors / total) * 100),
  }
}

export function enforceAnonymityThreshold<T>(values: readonly T[], minimum = 5): { visible: boolean; values: T[] } {
  return values.length >= minimum
    ? { visible: true, values: [...values] }
    : { visible: false, values: [] }
}

export function summarizeNumericAnswers(values: readonly number[]) {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return { count: 0, minimum: null, maximum: null, average: null, sum: 0 }
  const sum = finiteValues.reduce((total, value) => total + value, 0)
  return {
    count: finiteValues.length,
    minimum: Math.min(...finiteValues),
    maximum: Math.max(...finiteValues),
    average: sum / finiteValues.length,
    sum,
  }
}
