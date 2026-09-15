const MAX_DECIMAL_PLACES = 8

export function parseAccrualRate(value: string, decimalSeparator: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(decimalSeparator, '.')
  if (!/^(?:\d+(?:\.\d{1,8})?|\.\d{1,8})$/.test(normalized)) return null
  const parsed = Number(normalized)
  const fractionDigits = normalized.split('.')[1]?.length ?? 0
  return Number.isFinite(parsed) && parsed >= 0 && fractionDigits <= MAX_DECIMAL_PLACES ? parsed : null
}
