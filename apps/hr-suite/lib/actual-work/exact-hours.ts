const ZERO = BigInt('0')
const HOURS_SCALE = BigInt('10000')
const CENTISECONDS_PER_HOUR = BigInt('360000')
const CENTISECONDS_PER_SECOND = BigInt('100')
const CENTISECONDS_PER_MINUTE = BigInt('6000')
const TIME_UNITS_PER_HOUR = BigInt('36')

export class ExactHoursError extends Error {
  constructor(message = 'ACTUAL_WORK_HOURS_FORMAT_INVALID') {
    super(message)
    this.name = 'ExactHoursError'
  }
}

export function parseExactHours(value: string): bigint {
  const normalized = value.trim()
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(normalized)
  if (!match) throw new ExactHoursError()
  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(4, '0') || '0')
  return whole * HOURS_SCALE + fraction
}

export function formatExactHours(value: bigint): string {
  const sign = value < ZERO ? '-' : ''
  const absolute = value < ZERO ? -value : value
  const whole = absolute / HOURS_SCALE
  const fraction = (absolute % HOURS_SCALE).toString().padStart(4, '0').replace(/0+$/, '')
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ''}`
}

export function parseExactTime(value: string): bigint {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) throw new ExactHoursError()
  const hours = BigInt(match[1])
  const minutes = BigInt(match[2])
  const seconds = BigInt(match[3])
  const centiseconds = BigInt((match[4] ?? '').padEnd(2, '0') || '0')
  const totalCentiseconds = hours * CENTISECONDS_PER_HOUR
    + minutes * CENTISECONDS_PER_MINUTE
    + seconds * CENTISECONDS_PER_SECOND
    + centiseconds
  if (totalCentiseconds % TIME_UNITS_PER_HOUR !== ZERO) throw new ExactHoursError('ACTUAL_WORK_TIME_PRECISION_INVALID')
  return totalCentiseconds / TIME_UNITS_PER_HOUR
}

export function formatExactTime(value: bigint): string {
  if (value < ZERO) throw new ExactHoursError('ACTUAL_WORK_TIME_NEGATIVE')
  const totalCentiseconds = value * TIME_UNITS_PER_HOUR
  const hours = totalCentiseconds / CENTISECONDS_PER_HOUR
  const remainderAfterHours = totalCentiseconds % CENTISECONDS_PER_HOUR
  const minutes = remainderAfterHours / CENTISECONDS_PER_MINUTE
  const remainderAfterMinutes = remainderAfterHours % CENTISECONDS_PER_MINUTE
  const seconds = remainderAfterMinutes / CENTISECONDS_PER_SECOND
  const centiseconds = remainderAfterMinutes % CENTISECONDS_PER_SECOND
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

export function isPositiveExactHours(value: bigint): boolean {
  return value > ZERO
}

export function exactHoursToDatabase(value: bigint): string {
  return `${formatExactHours(value)}${formatExactHours(value).includes('.') ? '' : '.0000'}`
}
