import type { PayrollRoundingDefinition, PayrollRoundingDefinitionMode, PayrollRoundingMode } from './types'

const MAX_DECIMAL_TEXT_LENGTH = 160
const MAX_DECIMAL_SCALE = 36
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
    scale: number,
    mode: PayrollRoundingMode,
  ): FixedDecimal {
    if (other.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Division scale is outside the supported range.')
    }
    const numerator = this.coefficient * pow10(other.scale + scale)
    const denominator = other.coefficient * pow10(this.scale)
    return new FixedDecimal(divideRounded(numerator, denominator, mode), scale)
  }

  /** Divides only when the exact result has a finite base-10 representation. */
  divideExact(other: FixedDecimal): FixedDecimal {
    if (other.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
    const numerator = this.coefficient * pow10(other.scale)
    const denominator = other.coefficient * pow10(this.scale)
    for (let scale = 0; scale <= MAX_DECIMAL_SCALE; scale += 1) {
      const scaledNumerator = numerator * pow10(scale)
      if (scaledNumerator % denominator === ZERO) {
        return new FixedDecimal(scaledNumerator / denominator, scale)
      }
    }
    throw new PayrollEngineError('DECIMAL_DIVISION_ROUNDING_REQUIRED', 'Non-terminating division requires an explicit rounding rule.')
  }

  divideToScale(
    other: FixedDecimal,
    scale: number,
    mode: Exclude<PayrollRoundingDefinitionMode, 'NO_ROUNDING' | 'ROUND_DOWN_TO_MULTIPLE'>,
  ): FixedDecimal {
    if (other.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Division scale is outside the supported range.')
    }
    const numerator = this.coefficient * pow10(other.scale + scale)
    const denominator = other.coefficient * pow10(this.scale)
    let coefficient: bigint
    if (mode === 'FLOOR') coefficient = floorDivide(numerator, denominator)
    else if (mode === 'CEILING') coefficient = ceilingDivide(numerator, denominator)
    else if (mode === 'TRUNCATE') coefficient = numerator / denominator
    else coefficient = divideRounded(numerator, denominator, 'HALF_UP')
    return new FixedDecimal(coefficient, scale)
  }

  divideToIntegerFloor(other: FixedDecimal): FixedDecimal {
    if (other.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
    const numerator = this.coefficient * pow10(other.scale)
    const denominator = other.coefficient * pow10(this.scale)
    return FixedDecimal.fromInteger(floorDivide(numerator, denominator))
  }

  abs(): FixedDecimal {
    return new FixedDecimal(this.coefficient < ZERO ? -this.coefficient : this.coefficient, this.scale)
  }

  negate(): FixedDecimal {
    return new FixedDecimal(-this.coefficient, this.scale)
  }

  round(scale: number, mode: PayrollRoundingMode | PayrollRoundingDefinitionMode): FixedDecimal {
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
      throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Rounding scale is outside the supported range.')
    }
    if (mode === 'NO_ROUNDING') return this
    if (mode === 'ROUND_DOWN_TO_MULTIPLE') {
      throw new PayrollEngineError('ROUNDING_MULTIPLE_REQUIRED', 'Round-down-to-multiple requires a target multiple.')
    }
    if (this.scale <= scale) return new FixedDecimal(this.coefficient * pow10(scale - this.scale), scale)
    const divisor = pow10(this.scale - scale)
    if (mode === 'FLOOR') return new FixedDecimal(floorDivide(this.coefficient, divisor), scale)
    if (mode === 'CEILING') return new FixedDecimal(ceilingDivide(this.coefficient, divisor), scale)
    if (mode === 'TRUNCATE') return new FixedDecimal(this.coefficient / divisor, scale)
    return new FixedDecimal(divideRounded(this.coefficient, divisor, mode === 'ARITHMETIC' ? 'HALF_UP' : mode), scale)
  }

  roundDownToMultiple(targetMultiple: FixedDecimal): FixedDecimal {
    if (targetMultiple.coefficient <= ZERO) {
      throw new PayrollEngineError('ROUNDING_MULTIPLE_INVALID', 'The target multiple must be greater than zero.')
    }
    const numerator = this.coefficient * pow10(targetMultiple.scale)
    const denominator = targetMultiple.coefficient * pow10(this.scale)
    const multipleCount = floorDivide(numerator, denominator)
    return targetMultiple.multiply(FixedDecimal.fromInteger(multipleCount))
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
    let value = this.normalized()
    if (targetScale !== undefined) {
      if (!Number.isInteger(targetScale) || targetScale < 0 || targetScale > MAX_DECIMAL_SCALE) {
        throw new PayrollEngineError('DECIMAL_SCALE_INVALID', 'Serialization scale is outside the supported range.')
      }
      if (targetScale < this.scale) {
        const divisor = pow10(this.scale - targetScale)
        if (this.coefficient % divisor !== ZERO) {
          throw new PayrollEngineError('DECIMAL_SERIALIZATION_LOSS', 'Exact serialization cannot discard nonzero decimal places; apply an explicit rounding rule first.')
        }
        value = new FixedDecimal(this.coefficient / divisor, targetScale)
      } else {
        value = new FixedDecimal(this.coefficient * pow10(targetScale - this.scale), targetScale)
      }
    }
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

/** Applies one explicit statutory rounding definition without implicit scale choices. */
export function applyPayrollRounding(value: FixedDecimal, definition: PayrollRoundingDefinition): FixedDecimal {
  if (definition.mode === 'NO_ROUNDING') {
    if (definition.decimalPlaces !== undefined || definition.targetMultiple !== undefined) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'No-rounding definitions cannot set decimal places or a target multiple.')
    }
    return value
  }
  if (definition.mode === 'ROUND_DOWN_TO_MULTIPLE') {
    if (definition.decimalPlaces !== undefined || definition.targetMultiple === undefined) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'Round-down-to-multiple requires only a target multiple.')
    }
    return value.roundDownToMultiple(FixedDecimal.parse(definition.targetMultiple))
  }
  if (definition.decimalPlaces === undefined || definition.targetMultiple !== undefined) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'This rounding mode requires only decimal places.')
  }
  return value.round(definition.decimalPlaces, definition.mode)
}

/** Rounds a rational result directly, avoiding a hidden intermediate decimal scale. */
export function applyPayrollRoundingToRatio(
  numerator: FixedDecimal,
  denominator: FixedDecimal,
  definition: PayrollRoundingDefinition,
): FixedDecimal {
  if (denominator.coefficient === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
  if (definition.mode === 'NO_ROUNDING') return numerator.divideExact(denominator)
  if (definition.mode === 'ROUND_DOWN_TO_MULTIPLE') {
    if (typeof definition.targetMultiple !== 'string' || definition.decimalPlaces !== undefined) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'Round-down-to-multiple requires a target multiple only.')
    }
    const targetMultiple = FixedDecimal.parse(definition.targetMultiple)
    if (targetMultiple.coefficient <= ZERO) throw new PayrollEngineError('ROUNDING_MULTIPLE_INVALID', 'The target multiple must be greater than zero.')
    return targetMultiple.multiply(numerator.divideToIntegerFloor(denominator.multiply(targetMultiple)))
  }
  if (definition.decimalPlaces === undefined || definition.targetMultiple !== undefined) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'This rounding mode requires decimal places only.')
  }
  return numerator.divideToScale(denominator, definition.decimalPlaces, definition.mode)
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

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  if (remainder === ZERO) return quotient
  const sameSign = (numerator < ZERO) === (denominator < ZERO)
  return sameSign ? quotient : quotient - ONE
}

function ceilingDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === ZERO) throw new PayrollEngineError('DIVISION_BY_ZERO', 'Division by zero is not allowed.')
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  if (remainder === ZERO) return quotient
  const sameSign = (numerator < ZERO) === (denominator < ZERO)
  return sameSign ? quotient + ONE : quotient
}
