const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>()
const INTEGER_FORMATTERS = new Map<string, Intl.NumberFormat>()

function formatterFor(locale: string, currency: boolean): Intl.NumberFormat {
  const cache = currency ? CURRENCY_FORMATTERS : INTEGER_FORMATTERS
  const existing = cache.get(locale)
  if (existing) return existing

  const formatter = currency
    ? new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 })
  cache.set(locale, formatter)
  return formatter
}

export function formatPayrollMoney(value: string | null, locale: string): string {
  if (value === null || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return '—'

  const negative = value.startsWith('-')
  const unsignedValue = negative ? value.slice(1) : value
  const [rawInteger = '0', rawFraction = ''] = unsignedValue.split('.')
  const integerDigits = rawInteger.replace(/^0+(?=\d)/, '')
  const fractionDigits = rawFraction.padEnd(2, '0')
  const integer = BigInt(integerDigits)
  const currencyFormatter = formatterFor(locale, true)
  const integerFormatter = formatterFor(locale, false)
  const signPattern = currencyFormatter.formatToParts(BigInt(negative ? -1 : 1))
  const integerParts = integerFormatter.formatToParts(integer).filter(({ type }) => type === 'integer' || type === 'group')
  const firstInteger = signPattern.findIndex(({ type }) => type === 'integer' || type === 'group')
  const lastInteger = signPattern.findLastIndex(({ type }) => type === 'integer' || type === 'group')

  if (firstInteger < 0 || lastInteger < firstInteger) return '—'

  return [
    ...signPattern.slice(0, firstInteger),
    ...integerParts,
    ...signPattern.slice(lastInteger + 1),
  ].map((part) => part.type === 'fraction' ? fractionDigits : part.value).join('')
}

/** Display-only HALF_UP rounding for exact engine decimals; persisted values stay unrounded. */
export function formatPayrollMoneyForDisplay(value: string | null, locale: string): string {
  if (value === null || !/^-?\d+(?:\.\d{1,18})?$/.test(value)) return '—'
  const negative = value.startsWith('-')
  const unsignedValue = negative ? value.slice(1) : value
  const [integer = '0', fraction = ''] = unsignedValue.split('.')
  const kept = fraction.padEnd(2, '0').slice(0, 2)
  let cents = BigInt(integer) * BigInt(100) + BigInt(kept || '0')
  if ((fraction[2] ?? '0') >= '5') cents += BigInt(1)
  const rounded = `${negative && cents > BigInt(0) ? '-' : ''}${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, '0')}`
  return formatPayrollMoney(rounded, locale)
}
