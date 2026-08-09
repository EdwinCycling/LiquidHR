export function nextAvailableEmploymentNumber(usedNumbers: readonly string[]): string {
  const used = new Set(usedNumbers.map((number) => number.trim()))
  let candidate = 1
  while (used.has(String(candidate))) candidate += 1
  return String(candidate)
}
