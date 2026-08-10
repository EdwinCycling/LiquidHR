export function nextAvailableEmploymentNumber(usedNumbers: readonly string[]): string {
  let highest = '0'
  for (const value of usedNumbers) {
    const normalized = value.trim()
    if (!/^\d+$/.test(normalized)) continue
    const numericValue = normalized.replace(/^0+(?=\d)/, '')
    if (numericValue.length > highest.length || (numericValue.length === highest.length && numericValue > highest)) highest = numericValue
  }
  const digits = [...highest]
  let carry = 1
  for (let index = digits.length - 1; index >= 0 && carry === 1; index -= 1) {
    if (digits[index] === '9') digits[index] = '0'
    else { digits[index] = String(Number(digits[index]) + 1); carry = 0 }
  }
  return carry === 1 ? `1${digits.join('')}` : digits.join('')
}
