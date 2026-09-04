export function parseDecimalInput(value: string): number {
  const trimmed = value.trim().replace(/\s/g, '')
  if (!trimmed) return Number.NaN
  const commaIndex = trimmed.lastIndexOf(',')
  const dotIndex = trimmed.lastIndexOf('.')
  const normalized = commaIndex >= 0 && dotIndex >= 0
    ? commaIndex > dotIndex
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '')
    : trimmed.replace(',', '.')
  return Number(normalized)
}
