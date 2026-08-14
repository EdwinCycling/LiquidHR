export type SalaryApplicationRoute = 'MANUAL' | 'MINIMUM_WAGE' | 'SCALE_WITH_STEPS' | 'SALARY_BAND'

export type SalaryBandPositionStatus = 'UNDER_MINIMUM' | 'WITHIN_RANGE' | 'ABOVE_MAXIMUM' | 'NO_VALID_BAND'

export interface SalaryBandPositionBand {
  minimum: string
  midpoint: string
  maximum: string | null
}

export interface SalaryBandPosition {
  status: SalaryBandPositionStatus
  compaRatioPercentage: string | null
  rangePenetrationPercentage: string | null
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
  if (numerator < BigInt(0)) return -divideRoundedHalfUp(-numerator, denominator)
  return (numerator + denominator / BigInt(2)) / denominator
}

function formatSignedPercentage(value: bigint): string {
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value
  const divisor = BigInt(10) ** BigInt(PERCENTAGE_SCALE)
  const whole = absolute / divisor
  const fraction = (absolute % divisor).toString().padStart(PERCENTAGE_SCALE, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

function formatScaled(value: bigint, scale: number): string {
  const divisor = BigInt(10) ** BigInt(scale)
  const whole = value / divisor
  const fraction = (value % divisor).toString().padStart(scale, '0')
  return `${whole}.${fraction}`
}

function percentage(numerator: bigint, denominator: bigint): string {
  const multiplier = BigInt(100) * (BigInt(10) ** BigInt(PERCENTAGE_SCALE))
  return formatSignedPercentage(divideRoundedHalfUp(numerator * multiplier, denominator))
}

function validBand(band: SalaryBandPositionBand): boolean {
  const minimum = parseScaled(band.minimum, MONEY_SCALE)
  const midpoint = parseScaled(band.midpoint, MONEY_SCALE)
  const maximum = band.maximum === null ? null : parseScaled(band.maximum, MONEY_SCALE)
  return minimum > BigInt(0) && midpoint > minimum && (maximum === null || maximum > midpoint)
}

export function calculateSalaryBandPosition(
  salaryAmount: string,
  band: SalaryBandPositionBand | null,
): SalaryBandPosition {
  if (band === null || !validBand(band)) {
    return {
      status: 'NO_VALID_BAND',
      compaRatioPercentage: null,
      rangePenetrationPercentage: null,
    }
  }

  const salary = parseScaled(salaryAmount, MONEY_SCALE)
  const minimum = parseScaled(band.minimum, MONEY_SCALE)
  const midpoint = parseScaled(band.midpoint, MONEY_SCALE)
  const maximum = band.maximum === null ? null : parseScaled(band.maximum, MONEY_SCALE)

  return {
    status: salary < minimum ? 'UNDER_MINIMUM' : maximum !== null && salary > maximum ? 'ABOVE_MAXIMUM' : 'WITHIN_RANGE',
    compaRatioPercentage: percentage(salary, midpoint),
    rangePenetrationPercentage: maximum === null ? null : percentage(salary - minimum, maximum - minimum),
  }
}

export function calculateSalaryFromBandPercentage(
  percentageValue: string,
  band: SalaryBandPositionBand | null,
): string | null {
  if (band === null) return null
  try {
    if (!validBand(band)) return null
    const percentageValueScaled = parseScaled(percentageValue, PERCENTAGE_SCALE)
    const midpoint = parseScaled(band.midpoint, MONEY_SCALE)
    const denominator = BigInt(100) * (BigInt(10) ** BigInt(PERCENTAGE_SCALE))
    return formatScaled(divideRoundedHalfUp(midpoint * percentageValueScaled, denominator), MONEY_SCALE)
  } catch {
    return null
  }
}
