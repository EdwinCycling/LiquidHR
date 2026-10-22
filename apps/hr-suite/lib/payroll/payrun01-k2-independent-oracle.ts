/**
 * Independent integer-cent oracle for PAYD1 K2's synthetic November case.
 * This module intentionally imports no payroll engine or rules package.
 * Official table cells below are transcribed anchors, not engine outputs.
 */

export const PAYD1_K2_ORACLE_SOURCES = {
  cao: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf',
  pfzwPremium: 'https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026',
  pfzwRegulationWage: 'https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
  pfzwFormula: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html',
  paww: 'https://spaww.nl/files/secured/documents/berekening-bijdrage-paww-2026-rekenregels.pdf?inline=1',
  taxTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
  taxHandbook: 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf',
} as const

const parameters = {
  fullTimeMonthlySalaryCents: 281_900,
  contractHours: 32,
  fullTimeHours: 36,
  caoHealthAllowanceCents: 800,
  holidayRateBasisPoints: 800,
  currentYearEndRateBasisPoints: 800,
  priorYearStructuralYearEndRateBasisPoints: 550,
  pfzwFranchiseEuros: 17_283,
  employeePensionRateBasisPoints: 1_290,
  employerPensionRateBasisPoints: 1_300,
  pfzwArrangementWiaExcessFranchiseEuros: 79_409,
  pawwRateBasisPoints: 10,
  pawwMonthlyMaximumCents: 661_742,
  pawwOpeningPeriods: 2,
  pawwOpeningWageCents: 502_756,
  pawwOpeningContributionCents: 503,
  tableWageStepCents: 450,
  publishedTableWageCents: 230_850,
  publishedTaxWithCreditCents: 12_092,
  employerRatesBasisPoints: {
    awf: 274,
    aof: 627,
    wko: 50,
    whk: 181,
    zvw: 610,
  },
} as const

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0) || numerator < BigInt(0)) throw new Error('Oracle expects non-negative values and a positive denominator.')
  return (numerator * BigInt(2) + denominator) / (BigInt(2) * denominator)
}

function multiplyRate(amountCents: bigint, rateBasisPoints: number): bigint {
  return roundHalfUp(amountCents * BigInt(rateBasisPoints), BigInt(10_000))
}

function formatCents(cents: bigint): string {
  const euros = cents / BigInt(100)
  const remainder = (cents % BigInt(100)).toString().padStart(2, '0')
  return `${euros}.${remainder}`
}

export interface Payd1K2IndependentOracle {
  readonly contractualSalary: string
  readonly gross: string
  readonly pfzw: {
    readonly fullTimeAnnualSalary: string
    readonly holidayAllowanceReference: string
    readonly priorYearStructuralYearEndReference: string
    readonly regulationWageBeforeCeiling: string
    readonly regulationWageCeilingToWholeEuro: string
    readonly partTimeFactor: string
    readonly pensionableBase: string
    readonly employeePremium: string
    readonly employerPremium: string
    readonly wiaExcessBase: string
  }
  readonly paww: {
    readonly currentCashWage: string
    readonly cumulativeContributionAfterPeriod: string
    readonly contributionBeforePeriod: string
    readonly currentContribution: string
  }
  readonly tax: {
    readonly fiscalWage: string
    readonly tableWage: string
    readonly withholdingWithCredit: string
  }
  readonly net: string
  readonly employerCosts: {
    readonly awf: string
    readonly aof: string
    readonly wko: string
    readonly whk: string
    readonly zvw: string
    readonly employerInsuranceTotal: string
    readonly holidayReserve: string
    readonly yearEndReserve: string
    readonly total: string
  }
}

/** Returns the independent source-anchored expected result for this fixture. */
export function derivePayd1K2IndependentOracle(): Payd1K2IndependentOracle {
  const fullTimeMonthlySalaryCents = BigInt(parameters.fullTimeMonthlySalaryCents)
  const contractualSalaryCents = roundHalfUp(
    fullTimeMonthlySalaryCents * BigInt(parameters.contractHours),
    BigInt(parameters.fullTimeHours),
  )
  const grossCents = contractualSalaryCents + BigInt(parameters.caoHealthAllowanceCents)

  const fullTimeAnnualSalaryCents = fullTimeMonthlySalaryCents * BigInt(12)
  const holidayAllowanceCents = multiplyRate(fullTimeAnnualSalaryCents, parameters.holidayRateBasisPoints)
  const priorYearStructuralYearEndCents = multiplyRate(
    fullTimeAnnualSalaryCents,
    parameters.priorYearStructuralYearEndRateBasisPoints,
  )
  const regulationWageBeforeCeilingCents = fullTimeAnnualSalaryCents
    + holidayAllowanceCents
    + priorYearStructuralYearEndCents
  // PFZW UPA v5.0 requires the full-time regulation wage to round up to whole euros.
  const regulationWageEuros = (regulationWageBeforeCeilingCents + BigInt(99)) / BigInt(100)
  const partTimeFactorTenThousandths = roundHalfUp(
    BigInt(parameters.contractHours) * BigInt(10_000),
    BigInt(parameters.fullTimeHours),
  )
  const pensionableBaseCents = roundHalfUp(
    (regulationWageEuros - BigInt(parameters.pfzwFranchiseEuros)) * BigInt(100)
      * partTimeFactorTenThousandths,
    BigInt(10_000),
  )
  const employeePensionCents = roundHalfUp(
    pensionableBaseCents * BigInt(parameters.employeePensionRateBasisPoints),
    BigInt(10_000) * BigInt(12),
  )
  const employerPensionCents = roundHalfUp(
    pensionableBaseCents * BigInt(parameters.employerPensionRateBasisPoints),
    BigInt(10_000) * BigInt(12),
  )
  const wiaExcessBaseCents = regulationWageEuros > BigInt(parameters.pfzwArrangementWiaExcessFranchiseEuros)
    ? (regulationWageEuros - BigInt(parameters.pfzwArrangementWiaExcessFranchiseEuros))
      * partTimeFactorTenThousandths
    : BigInt(0)

  const openingAndCurrentWageCents = BigInt(parameters.pawwOpeningWageCents) + grossCents
  const calculatedOpeningPawwContributionCents = multiplyRate(
    BigInt(parameters.pawwOpeningWageCents),
    parameters.pawwRateBasisPoints,
  )
  if (calculatedOpeningPawwContributionCents !== BigInt(parameters.pawwOpeningContributionCents)) {
    throw new Error('The synthetic PAWW opening contribution does not reconcile to its cumulative wage under VCR.')
  }
  const cumulativeMaximumCents = BigInt(parameters.pawwMonthlyMaximumCents)
    * BigInt(parameters.pawwOpeningPeriods + 1)
  const cumulativePawwBaseCents = openingAndCurrentWageCents > cumulativeMaximumCents
    ? cumulativeMaximumCents
    : openingAndCurrentWageCents
  const cumulativePawwContributionCents = multiplyRate(cumulativePawwBaseCents, parameters.pawwRateBasisPoints)
  const pawwContributionCents = cumulativePawwContributionCents - calculatedOpeningPawwContributionCents
  const fiscalWageCents = grossCents - employeePensionCents - pawwContributionCents
  const tableWageCents = (fiscalWageCents / BigInt(parameters.tableWageStepCents))
    * BigInt(parameters.tableWageStepCents)
  if (tableWageCents !== BigInt(parameters.publishedTableWageCents)) {
    throw new Error('The fixture no longer maps to the independently transcribed official Belastingdienst table row.')
  }
  const taxCents = BigInt(parameters.publishedTaxWithCreditCents)
  const netCents = grossCents - employeePensionCents - pawwContributionCents - taxCents

  const employerInsurance = Object.fromEntries(Object.entries(parameters.employerRatesBasisPoints).map(([name, rate]) => [
    name,
    multiplyRate(fiscalWageCents, rate),
  ])) as Record<keyof typeof parameters.employerRatesBasisPoints, bigint>
  const employerInsuranceTotalCents = Object.values(employerInsurance).reduce((sum, amount) => sum + amount, BigInt(0))
  // Fixture choice: the one-time CAO health contribution is outside the reserve base.
  const reserveableSalaryCents = grossCents - BigInt(parameters.caoHealthAllowanceCents)
  const holidayReserveCents = multiplyRate(reserveableSalaryCents, parameters.currentYearEndRateBasisPoints)
  const yearEndReserveCents = multiplyRate(reserveableSalaryCents, parameters.currentYearEndRateBasisPoints)
  const totalEmployerCostsCents = grossCents + employerPensionCents + employerInsuranceTotalCents
    + holidayReserveCents + yearEndReserveCents

  return {
    contractualSalary: formatCents(contractualSalaryCents),
    gross: formatCents(grossCents),
    pfzw: {
      fullTimeAnnualSalary: formatCents(fullTimeAnnualSalaryCents),
      holidayAllowanceReference: formatCents(holidayAllowanceCents),
      priorYearStructuralYearEndReference: formatCents(priorYearStructuralYearEndCents),
      regulationWageBeforeCeiling: formatCents(regulationWageBeforeCeilingCents),
      regulationWageCeilingToWholeEuro: formatCents(regulationWageEuros * BigInt(100)),
      partTimeFactor: `0.${partTimeFactorTenThousandths.toString().padStart(4, '0')}`,
      pensionableBase: formatCents(pensionableBaseCents),
      employeePremium: formatCents(employeePensionCents),
      employerPremium: formatCents(employerPensionCents),
      wiaExcessBase: formatCents(wiaExcessBaseCents),
    },
    paww: {
      currentCashWage: formatCents(grossCents),
      cumulativeContributionAfterPeriod: formatCents(cumulativePawwContributionCents),
      contributionBeforePeriod: formatCents(calculatedOpeningPawwContributionCents),
      currentContribution: formatCents(pawwContributionCents),
    },
    tax: {
      fiscalWage: formatCents(fiscalWageCents),
      tableWage: formatCents(tableWageCents),
      withholdingWithCredit: formatCents(taxCents),
    },
    net: formatCents(netCents),
    employerCosts: {
      awf: formatCents(employerInsurance.awf),
      aof: formatCents(employerInsurance.aof),
      wko: formatCents(employerInsurance.wko),
      whk: formatCents(employerInsurance.whk),
      zvw: formatCents(employerInsurance.zvw),
      employerInsuranceTotal: formatCents(employerInsuranceTotalCents),
      holidayReserve: formatCents(holidayReserveCents),
      yearEndReserve: formatCents(yearEndReserveCents),
      total: formatCents(totalEmployerCostsCents),
    },
  }
}
