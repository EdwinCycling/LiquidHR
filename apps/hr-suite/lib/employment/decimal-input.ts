export function parseDecimalInput(value: string): number {
  const trimmed = value.trim().replace(/\s/g, '')
  if (!trimmed) return Number.NaN
  const normalized = trimmed.includes(',')
    ? trimmed.includes('.')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(',', '.')
    : trimmed
  return Number(normalized)
}
