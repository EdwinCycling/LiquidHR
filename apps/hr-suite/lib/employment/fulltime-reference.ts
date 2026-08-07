export const MAX_PART_TIME_FACTOR = 1

export function capPartTimeFactor(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_PART_TIME_FACTOR, Math.max(0, value))
}

export function calculateCappedPartTimeFactor(
  contractHoursPerWeek: number,
  fulltimeHoursPerWeek: number,
): number {
  if (!Number.isFinite(contractHoursPerWeek) || !Number.isFinite(fulltimeHoursPerWeek) || fulltimeHoursPerWeek <= 0) {
    return 0
  }
  return capPartTimeFactor(contractHoursPerWeek / fulltimeHoursPerWeek)
}
