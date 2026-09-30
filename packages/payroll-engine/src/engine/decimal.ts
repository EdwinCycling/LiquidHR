import type { PayrollRoundingMode } from './types'

const MAX_DECIMAL_TEXT_LENGTH = 160
const MAX_DECIMAL_SCALE = 36
const DEFAULT_DIVISION_SCALE = 18
const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const TEN = BigInt(10)

export class PayrollEngineError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'PayrollEngineError'
  }
}

/** Exact base-10 decimal backed by an integer coefficient. Monetary values never use JS number. */
export class FixedDecimal {
  private constructor(readonly coefficient: bigint, readonly scale: number) {
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Decimal scale is outside the supported range.')
    }
    Object.freeze(this)
  }

  static parse(value: string): FixedDecimal {
    if (value.length === 0 || value.length > MAX_DECIMAL_TEXT_LENGTH) {
      throw new PayrollEngineError('DECIMAL_FORMAT_INVALID', 'Decimal text is empty or exceeds the supported size.')
    }
    const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value)
    if (!match) throw new PayrollEngineError('DECIMAL_FORMAT_INVALID', 'Decimal values must use plain base-10 text.')
    const fraction = match[3] ?? ''
    if (fraction.length > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Decimal scale is outside the supported range.')
    }
    const magnitude = BigInt(`${match[2]}${fraction}`)
    return new FixedDecimal(match[1] === '-' ? -magnitude : magnitude, fraction.length)
  }

  static fromInteger(value: bigint): FixedDecimal {
    return new FixedDecimal(value, 0)
  }

  add(other: FixedDecimal): FixedDecimal {
    const scale = Math.max(this.scale, other.scale)
    return new FixedDecimal(
      this.coefficient * pow10(scale - this.scale) + other.coefficient * pow10(scale - other.scale),
      scale,
    )
  }

  subtract(other: FixedDecimal): FixedDecimal {
    const scale = Math.max(this.scale, other.scale)
    return new FixedDecimal(
      this.coefficient * pow10(scale - this.scale) - other.coefficient * pow10(scale - other.scale),
      scale,
    )
  }

  multiply(other: FixedDecimal): FixedDecimal {
    const scale = this.scale + other.scale
    if (scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Multiplication exceeds the supported decimal scale.')
    }
    return new FixedDecimal(this.coefficient * other.coefficient, scale)
  }

  divide(
    other: FixedDecimal,
    scale = DEFAULT_DIVISION_SCALE,
    mode: PayrollRoundingMode = 'HALF_UP',
  ): FixedDecimal {
    if (other.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Division scale is outside the supported range.')
    }
    const numerator = this.coefficient * pow10(other.scale + scale)
    const denominator = other.coefficient * pow10(this.scale)
    return new FixedDecimal(divideRounded(numerator, denominator, mode), scale)
  }

  abs(): FixedDecimal {
    return new FixedDecimal(this.coefficient < ZERO ? -this.coefficient : this.coefficient, this.scale)
  }

  negate(): FixedDecimal {
    return new FixedDecimal(-this.coefficient, this.scale)
  }

  round(scale: number, mode: PayrollRoundingMode): FixedDecimal {
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Rounding scale is outside the supported range.')
    }
    if (this.scale <= scale) return new FixedDecimal(this.coefficient * pow10(scale - this.scale), scale)
    return new FixedDecimal(divideRounded(this.coefficient, pow10(this.scale - scale), mode), scale)
  }

  compare(other: FixedDecimal): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale)
    const left = this.coefficient * pow10(scale - this.scale)
    const right = other.coefficient * pow10(scale - other.scale)
    return left < right ? -1 : left > right ? 1 : 0
  }

  toBigIntExact(): bigint {
    if (this.scale === 0) return this.coefficient
    const divisor = pow10(this.scale)
    if (this.coefficient % divisor !== ZERO) {
      throw new PayrollEngineError('DECIMAL_INTEGER_REQUIRED', 'A whole-number value was required.')
    }
    return this.coefficient / divisor
  }

  toString(targetScale?: number): string {
    const value = targetScale === undefined ? this.normalized() : this.round(targetScale, 'HALF_UP')
    const sign = value.coefficient < ZERO ? '-' : ''
    const magnitude = value.coefficient < ZERO ? -value.coefficient : value.coefficient
    const digits = magnitude.toString().padStart(value.scale + 1, '0')
    if (value.scale === 0) return `${sign}${digits}`
    const split = digits.length - value.scale
    return `${sign}${digits.slice(0, split)}.${digits.slice(split)}`
  }

  private normalized(): FixedDecimal {
    if (this.coefficient === ZERO) return new FixedDecimal(ZERO, 0)
    let coefficient = this.coefficient
    let scale = this.scale
    while (scale > 0 && coefficient % TEN === ZERO) {
      coefficient /= TEN
      scale -= 1
    }
    return scale === this.scale ? this : new FixedDecimal(coefficient, scale)
  }
}

function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_DECIMAL_SCALE * 2) {
    throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Decimal scale is outside the supported range.')
  }
  return TEN ** BigInt(exponent)
}

function divideRounded(numerator: bigint, denominator: bigint, mode: PayrollRoundingMode): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  if (remainder === ZERO || mode === 'DOWN') return quotient
  const sign = (numerator < ZERO) !== (denominator < ZERO) ? -ONE : ONE
  if (mode === 'UP') return quotient + sign

  const twiceRemainder = (remainder < ZERO ? -remainder : remainder) * TWO
  const absoluteDenominator = denominator < ZERO ? -denominator : denominator
  if (twiceRemainder < absoluteDenominator) return quotient
  if (twiceRemainder > absoluteDenominator) return quotient + sign
  if (mode === 'HALF_UP') return quotient + sign
  return quotient % TWO === ZERO ? quotient : quotient + sign
}
