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

function applyPercentCents(baseCents: bigint, rateUnits: bigint, rateScale: bigint): bigint {
  return divideHalfUp(baseCents * rateUnits, BigInt(100) * rateScale)
}

function ceilPositiveRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < BigInt(0) || denominator <= BigInt(0)) throw new Error('RETAIL_ORACLE_INVALID_CEILING')
  return (numerator + denominator - BigInt(1)) / denominator
}

function parseCents(amount: string): bigint {
  const match = /^(\d+)\.(\d{2})$/.exec(amount)
  if (!match) throw new Error('RETAIL_ORACLE_INVALID_MONEY')
  return BigInt(match[1]!) * BigInt(100) + BigInt(match[2]!)
}

function nl2026MonthlyWageTaxCents(taxableWageCents: bigint) {
  const annualizedWageCents = taxableWageCents * BigInt(12)
  const annualTableWageCents = annualizedWageCents / BigInt(5_400) * BigInt(5_400)
  const annualTableWageEuros = annualTableWageCents / BigInt(100)
  const annualTaxBeforeCreditsEuros = annualTableWageEuros * BigInt(3_575) / BigInt(10_000)
  const generalCreditEuros = BigInt(3_115)
  const scale = BigInt(100_000)
  const labourStepOne = BigInt(996) * scale < annualTableWageEuros * BigInt(8_324)
    ? BigInt(996) * scale
    : annualTableWageEuros * BigInt(8_324)
  const labourStepTwo = BigInt(5_300) * scale < labourStepOne
    + (annualTableWageEuros > BigInt(11_965)
      ? (annualTableWageEuros - BigInt(11_965)) * BigInt(31_009)
      : BigInt(0))
    ? BigInt(5_300) * scale
    : labourStepOne + (annualTableWageEuros > BigInt(11_965)
      ? (annualTableWageEuros - BigInt(11_965)) * BigInt(31_009)
      : BigInt(0))
  const labourStepThreeUncapped = labourStepTwo
    + (annualTableWageEuros > BigInt(25_845)
      ? (annualTableWageEuros - BigInt(25_845)) * BigInt(1_950)
      : BigInt(0))
  const labourStepThree = labourStepThreeUncapped < BigInt(5_685) * scale
    ? labourStepThreeUncapped
    : BigInt(5_685) * scale
  const labourCreditTaper = annualTableWageEuros > BigInt(45_592)
    ? (annualTableWageEuros - BigInt(45_592)) * BigInt(6_510)
    : BigInt(0)
  const theoreticalLabourCreditEuros = ceilPositiveRatio(
    labourStepThree > labourCreditTaper ? labourStepThree - labourCreditTaper : BigInt(0),
    scale,
  )
  const excessCreditsEuros = generalCreditEuros + theoreticalLabourCreditEuros > annualTaxBeforeCreditsEuros
    ? generalCreditEuros + theoreticalLabourCreditEuros - annualTaxBeforeCreditsEuros
    : BigInt(0)
  const appliedLabourCreditEuros = theoreticalLabourCreditEuros > excessCreditsEuros
    ? theoreticalLabourCreditEuros - excessCreditsEuros
    : BigInt(0)
  const taxAfterLabourCreditEuros = annualTaxBeforeCreditsEuros > appliedLabourCreditEuros
    ? annualTaxBeforeCreditsEuros - appliedLabourCreditEuros
    : BigInt(0)
  const appliedGeneralCreditEuros = generalCreditEuros < taxAfterLabourCreditEuros
    ? generalCreditEuros
    : taxAfterLabourCreditEuros
  const annualTaxAfterCreditsEuros = taxAfterLabourCreditEuros - appliedGeneralCreditEuros
  const wageTaxCents = divideHalfUp(annualTaxAfterCreditsEuros * BigInt(100), BigInt(12))

  return {
    annualizedWage: formatCents(annualizedWageCents),
    annualTableWage: formatCents(annualTableWageCents),
    annualTaxBeforeCredits: formatCents(annualTaxBeforeCreditsEuros * BigInt(100)),
    annualGeneralCredit: formatCents(generalCreditEuros * BigInt(100)),
    annualTheoreticalLabourCredit: formatCents(theoreticalLabourCreditEuros * BigInt(100)),
    annualLabourCredit: formatCents(appliedLabourCreditEuros * BigInt(100)),
    annualTaxAfterCredits: formatCents(annualTaxAfterCreditsEuros * BigInt(100)),
    wageTaxCents,
  } as const
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
  const monthlyFranchiseCents = divideHalfUp(BigInt(1_868_000), BigInt(12))
  const monthlyPensionableBaseCents = grossCents - monthlyFranchiseCents
  const annualPensionableBaseCents = monthlyPensionableBaseCents * BigInt(12)
  const totalPensionCents = applyPercentCents(monthlyPensionableBaseCents, BigInt(2_475), BigInt(100))
  const employeePensionCents = applyPercentCents(monthlyPensionableBaseCents, BigInt(61_875), BigInt(10_000))
  const employerPensionCents = totalPensionCents - employeePensionCents
  const taxableWageCents = grossCents - employeePensionCents
  const annualTaxableCents = taxableWageCents * BigInt(12)
  const officialTableStepAnnualCents = BigInt(5_400)
  const tableAnnualCents = annualTaxableCents / officialTableStepAnnualCents * officialTableStepAnnualCents
  const tableMonthlyCents = tableAnnualCents / BigInt(12)
  const wageTaxCents = BigInt(110_717)
  const netCents = grossCents - employeePensionCents - wageTaxCents
  const employerRates = {
    awf: applyPercentCents(taxableWageCents, BigInt(274), BigInt(100)),
    aof: applyPercentCents(taxableWageCents, BigInt(627), BigInt(100)),
    wko: applyPercentCents(taxableWageCents, BigInt(50), BigInt(100)),
    whk: applyPercentCents(taxableWageCents, BigInt(193), BigInt(100)),
    zvw: applyPercentCents(taxableWageCents, BigInt(610), BigInt(100)),
  }
  const employerInsuranceCents = Object.values(employerRates).reduce((total, amount) => total + amount, BigInt(0))
  const holidayReserveCents = applyPercentCents(grossCents, BigInt(800), BigInt(100))
  const employerCostCents = grossCents + employerPensionCents + employerInsuranceCents + holidayReserveCents

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
    monthlyPensionableBase: formatCents(monthlyPensionableBaseCents),
    annualPensionableBase: formatCents(annualPensionableBaseCents),
    pensionTotal: formatCents(totalPensionCents),
    employeePension: formatCents(employeePensionCents),
    employerPension: formatCents(employerPensionCents),
    pensionAllocationDifference: formatCents(totalPensionCents - employeePensionCents - employerPensionCents),
    taxableWage: formatCents(taxableWageCents),
    annualTaxTableWage: formatCents(tableAnnualCents),
    monthlyTaxTableWage: formatCents(tableMonthlyCents),
    wageTax: formatCents(wageTaxCents),
    net: formatCents(netCents),
    employerRates: {
      awf: formatCents(employerRates.awf),
      aof: formatCents(employerRates.aof),
      wko: formatCents(employerRates.wko),
      whk: formatCents(employerRates.whk),
      zvw: formatCents(employerRates.zvw),
      total: formatCents(employerInsuranceCents),
    },
    holidayReserve: formatCents(holidayReserveCents),
    totalEmployerCost: formatCents(employerCostCents),
    holidayAllowanceIsSeparate: true,
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

/** Independent R2 full-chain oracle. Inputs are cents and pinned 2026 parameters; no production imports. */
export function derivePayd2RetailR2NetIndependentOracle() {
  const gross = derivePayd2RetailR2IndependentOracle()
  const grossCents = parseCents(gross.gross)
  const monthlyFranchiseCents = divideHalfUp(BigInt(1_868_000), BigInt(12))
  const proratedFranchiseCents = divideHalfUp(monthlyFranchiseCents * BigInt(6_316), BigInt(10_000))
  const monthlyPensionableBaseCents = grossCents - proratedFranchiseCents
  const totalPensionCents = applyPercentCents(monthlyPensionableBaseCents, BigInt(2_475), BigInt(100))
  const employeePensionCents = applyPercentCents(monthlyPensionableBaseCents, BigInt(61_875), BigInt(10_000))
  const employerPensionCents = totalPensionCents - employeePensionCents
  const taxableWageCents = grossCents - employeePensionCents
  const tax = nl2026MonthlyWageTaxCents(taxableWageCents)
  const netCents = grossCents - employeePensionCents - tax.wageTaxCents
  const employerRatesCents = {
    awf: applyPercentCents(taxableWageCents, BigInt(274), BigInt(100)),
    aof: applyPercentCents(taxableWageCents, BigInt(627), BigInt(100)),
    wko: applyPercentCents(taxableWageCents, BigInt(50), BigInt(100)),
    whk: applyPercentCents(taxableWageCents, BigInt(193), BigInt(100)),
    zvw: applyPercentCents(taxableWageCents, BigInt(610), BigInt(100)),
  }
  const employerInsuranceCents = Object.values(employerRatesCents).reduce((total, amount) => total + amount, BigInt(0))
  const holidayReserveCents = applyPercentCents(grossCents, BigInt(800), BigInt(100))
  const employerCostCents = grossCents + employerPensionCents + employerInsuranceCents + holidayReserveCents

  return {
    gross: formatCents(grossCents),
    baseMonthlyGross: gross.baseMonthlyGross,
    selectedPremiumGross: gross.selectedPremiumGross,
    monthlyFranchise: formatCents(monthlyFranchiseCents),
    proratedFranchise: formatCents(proratedFranchiseCents),
    monthlyPensionableBase: formatCents(monthlyPensionableBaseCents),
    totalPension: formatCents(totalPensionCents),
    employeePension: formatCents(employeePensionCents),
    employerPension: formatCents(employerPensionCents),
    taxableWage: formatCents(taxableWageCents),
    taxTrace: {
      annualizedWage: tax.annualizedWage,
      annualTableWage: tax.annualTableWage,
      annualTaxBeforeCredits: tax.annualTaxBeforeCredits,
      annualGeneralCredit: tax.annualGeneralCredit,
      annualTheoreticalLabourCredit: tax.annualTheoreticalLabourCredit,
      annualLabourCredit: tax.annualLabourCredit,
      annualTaxAfterCredits: tax.annualTaxAfterCredits,
    },
    wageTax: formatCents(tax.wageTaxCents),
    net: formatCents(netCents),
    employerRates: {
      awf: formatCents(employerRatesCents.awf),
      aof: formatCents(employerRatesCents.aof),
      wko: formatCents(employerRatesCents.wko),
      whk: formatCents(employerRatesCents.whk),
      zvw: formatCents(employerRatesCents.zvw),
      total: formatCents(employerInsuranceCents),
    },
    holidayReserve: formatCents(holidayReserveCents),
    totalEmployerCost: formatCents(employerCostCents),
    ruleVersions: {
      cao: 'CAO-RETAIL-NON-FOOD-2026.7',
      wageTax: 'NL-2026-01',
      pension: 'BPF-DETAILHANDEL-2026-v1',
      employer: 'SYNTHETIC-R2-EMPLOYER-2026-v1',
    },
  } as const
}
