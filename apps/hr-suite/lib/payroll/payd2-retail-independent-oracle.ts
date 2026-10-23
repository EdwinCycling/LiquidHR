/** Independent BigInt-cent oracle for the pinned synthetic Retail R1/R2 cases. */

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < BigInt(0) || denominator <= BigInt(0)) throw new Error('RETAIL_ORACLE_INVALID_RATIO')
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2))
}

function formatCents(cents: bigint): string {
  const sign = cents < BigInt(0) ? '-' : ''
  const absolute = cents < BigInt(0) ? -cents : cents
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`
}

function formatScaled(numerator: bigint, denominator: bigint, decimals: number): string {
  const scale = BigInt(10) ** BigInt(decimals)
  const units = divideHalfUp(numerator * scale, denominator)
  const whole = units / scale
  const fraction = String(units % scale).padStart(decimals, '0')
  return `${whole}.${fraction}`
}

function monthlyGrossCents(
  hourlyRateCents: bigint,
  contractHours: bigint,
  fullTimeHours: bigint,
): bigint {
  const monthlyConversionHoursHundredths = BigInt(16_467)
  return divideHalfUp(
    hourlyRateCents * monthlyConversionHoursHundredths * contractHours,
    BigInt(100) * fullTimeHours,
  )
}

export function derivePayd2RetailR1IndependentOracle() {
  const existingRateCents = BigInt(2_890)
  const indexNumerator = BigInt(1_019)
  const indexDenominator = BigInt(1_000)
  const indexedRateBeforeRoundingCentsNumerator = existingRateCents * indexNumerator
  const indexedRateCents = divideHalfUp(indexedRateBeforeRoundingCentsNumerator, indexDenominator)
  const maximumRateCents = BigInt(2_895)
  const appliedRateCents = indexedRateCents > maximumRateCents ? maximumRateCents : indexedRateCents
  const grossCents = monthlyGrossCents(appliedRateCents, BigInt(38), BigInt(38))

  return {
    previousHourlyRate: formatCents(existingRateCents),
    indexationRate: '0.019',
    indexedHourlyRateBeforeRounding: formatScaled(
      indexedRateBeforeRoundingCentsNumerator,
      BigInt(100_000),
      4,
    ),
    indexedHourlyRateBeforeCap: formatCents(indexedRateCents),
    maximumHourlyRate: formatCents(maximumRateCents),
    appliedHourlyRate: formatCents(appliedRateCents),
    baseMonthlyGross: formatCents(grossCents),
    selectedPremiumGross: '0.00',
    gross: formatCents(grossCents),
  } as const
}

export function derivePayd2RetailR2IndependentOracle() {
  const hourlyRateCents = BigInt(1_544)
  const baseMonthlyGrossCents = monthlyGrossCents(hourlyRateCents, BigInt(24), BigInt(38))
  const weekdayNightHours = BigInt(1)
  const sundayHours = BigInt(1)
  const dailyOvertimeHours = BigInt(2)
  const overlappingOvertimeHours = dailyOvertimeHours < weekdayNightHours + sundayHours
    ? dailyOvertimeHours
    : weekdayNightHours + sundayHours
  const overtimeOnlyHours = dailyOvertimeHours - overlappingOvertimeHours
  const premiumBasisPercent = (weekdayNightHours + sundayHours) * BigInt(50) + overtimeOnlyHours * BigInt(25)
  const selectedPremiumGrossCents = divideHalfUp(hourlyRateCents * premiumBasisPercent, BigInt(100))
  const grossCents = baseMonthlyGrossCents + selectedPremiumGrossCents

  return {
    hourlyBaseRate: formatCents(hourlyRateCents),
    baseMonthlyGross: formatCents(baseMonthlyGrossCents),
    weekdayNightHours: String(weekdayNightHours),
    sundayHours: String(sundayHours),
    dailyOvertimeHours: String(dailyOvertimeHours),
    overlappingOvertimeHours: String(overlappingOvertimeHours),
    overtimeOnlyHours: String(overtimeOnlyHours),
    selectedPremiumGross: formatCents(selectedPremiumGrossCents),
    gross: formatCents(grossCents),
  } as const
}
