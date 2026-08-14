export interface SalaryBandAnchors {
  minimum: string
  midpoint: string
  maximum: string | null
}

export interface SalaryBandMetrics {
  rangeSpreadPercentage: string | null
  midpointProgressionPercentage: string | null
  overlapPercentage: string | null
  hasGap: boolean | null
}

const MONEY_SCALE = 2
const PERCENTAGE_SCALE = 2

function parseScaled(value: string, scale: number): bigint {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('INVALID_DECIMAL')
  const [whole, fraction = ''] = normalized.split('.')
  if (fraction.length > scale) throw new Error('DECIMAL_PRECISION_EXCEEDED')
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`)
}

function divideRoundedHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) throw new Error('INVALID_DIVISOR')
  return (numerator + denominator / BigInt(2)) / denominator
}

function formatScaled(value: bigint, scale: number): string {
  const divisor = BigInt(10) ** BigInt(scale)
  const whole = value / divisor
  const fraction = (value % divisor).toString().padStart(scale, '0')
  return `${whole}.${fraction}`
}

function formatMoney(cents: bigint): string {
  return formatScaled(cents, MONEY_SCALE)
}

function percentage(numerator: bigint, denominator: bigint): string {
  const multiplier = BigInt(100) * (BigInt(10) ** BigInt(PERCENTAGE_SCALE))
  return formatScaled(divideRoundedHalfUp(numerator * multiplier, denominator), PERCENTAGE_SCALE)
}

export function deriveAnchorsFromMidpointAndSpread(midpoint: string, spreadPercentage: string): SalaryBandAnchors {
  const midpointCents = parseScaled(midpoint, MONEY_SCALE)
  const spreadHundredths = parseScaled(spreadPercentage, PERCENTAGE_SCALE)
  const oneHundredPercent = BigInt(100) * (BigInt(10) ** BigInt(PERCENTAGE_SCALE))
  const twoHundredPercent = BigInt(2) * oneHundredPercent
  const denominator = twoHundredPercent + spreadHundredths

  const minimumCents = divideRoundedHalfUp(midpointCents * twoHundredPercent, denominator)
  const maximumCents = divideRoundedHalfUp(
    midpointCents * BigInt(2) * (oneHundredPercent + spreadHundredths),
    denominator,
  )

  return {
    minimum: formatMoney(minimumCents),
    midpoint: formatMoney(midpointCents),
    maximum: formatMoney(maximumCents),
  }
}

export function deriveMidpointFromMinimumAndMaximum(minimum: string, maximum: string): string {
  const minimumCents = parseScaled(minimum, MONEY_SCALE)
  const maximumCents = parseScaled(maximum, MONEY_SCALE)
  if (maximumCents <= minimumCents) throw new Error('INVALID_BAND_ANCHORS')
  return formatMoney(divideRoundedHalfUp(minimumCents + maximumCents, BigInt(2)))
}

export function calculateBandMetrics(
  current: SalaryBandAnchors,
  previous?: SalaryBandAnchors,
): SalaryBandMetrics {
  const minimum = parseScaled(current.minimum, MONEY_SCALE)
  const midpoint = parseScaled(current.midpoint, MONEY_SCALE)
  const maximum = current.maximum === null ? null : parseScaled(current.maximum, MONEY_SCALE)
  if (minimum <= BigInt(0) || midpoint <= minimum || (maximum !== null && maximum <= midpoint)) {
    throw new Error('INVALID_BAND_ANCHORS')
  }

  const rangeSpreadPercentage = maximum === null ? null : percentage(maximum - minimum, minimum)
  if (!previous) {
    return { rangeSpreadPercentage, midpointProgressionPercentage: null, overlapPercentage: null, hasGap: null }
  }

  const previousMinimum = parseScaled(previous.minimum, MONEY_SCALE)
  const previousMidpoint = parseScaled(previous.midpoint, MONEY_SCALE)
  const previousMaximum = previous.maximum === null ? null : parseScaled(previous.maximum, MONEY_SCALE)
  if (previousMinimum <= BigInt(0) || previousMidpoint <= previousMinimum || (previousMaximum !== null && previousMaximum <= previousMidpoint)) {
    throw new Error('INVALID_BAND_ANCHORS')
  }

  const midpointProgressionPercentage = percentage(midpoint - previousMidpoint, previousMidpoint)
  if (previousMaximum === null) {
    return { rangeSpreadPercentage, midpointProgressionPercentage, overlapPercentage: null, hasGap: null }
  }

  const hasGap = minimum > previousMaximum
  const overlapPercentage = minimum >= previousMaximum
    ? '0.00'
    : percentage(previousMaximum - minimum, previousMaximum - previousMinimum)

  return { rangeSpreadPercentage, midpointProgressionPercentage, overlapPercentage, hasGap }
}
